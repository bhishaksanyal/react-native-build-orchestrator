import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { confirm, intro, isCancel, outro, select, spinner } from "@clack/prompts";
import pc from "picocolors";
import { execa } from "execa";

import { loadConfig } from "../utils/config.js";
import { interpolate, readDotEnv } from "../utils/env.js";
import { createRuntimeVars, writeRuntimeEnvExports } from "../utils/runtime-exports.js";
import {
  asPlatform,
  asBuildType,
  asAndroidArtifact
} from "../utils/validation.js";
import { resolveFlavorValue, toFlavorTaskName } from "../utils/flavor.js";
import { resolveAndroidOutputHint } from "../utils/build.js";
import { runCommandWithLogs } from "../utils/exec.js";
import {
  BUILD_TYPES,
  PLATFORMS,
  type AndroidArtifact,
  type BuildType,
  type Platform
} from "../types.js";

interface BuildOptions {
  env?: string;
  type?: string;
  platform?: string;
  flavor?: string;
  androidArtifact?: string;
  cwd?: string;
  dryRun?: boolean;
  fast?: boolean;
  rawLogs?: boolean;
}

function applyAndroidArtifactToCommand(
  command: string,
  buildType: BuildType,
  artifact: AndroidArtifact
): string {
  if (command.includes("{{ANDROID_ARTIFACT") || command.includes("{{ANDROID_TASK")) {
    return command;
  }

  if (buildType === "development") {
    const debugTask = artifact === "bundle" ? "bundleDebug" : "assembleDebug";
    return command
      .replace(/\bassembleDebug\b/g, debugTask)
      .replace(/\bbundleDebug\b/g, debugTask);
  }

  const releaseTask = artifact === "bundle" ? "bundleRelease" : "assembleRelease";
  return command
    .replace(/\bassembleRelease\b/g, releaseTask)
    .replace(/\bbundleRelease\b/g, releaseTask);
}

function applyAndroidFlavorToCommand(
  command: string,
  buildType: BuildType,
  flavor: string,
  artifact: AndroidArtifact
): string {
  if (
    command.includes("{{FLAVOR") ||
    command.includes("{{FLAVOR_NAME") ||
    command.includes("{{FLAVOR_VALUE") ||
    command.includes("{{FLAVOR_TASK")
  ) {
    return command;
  }

  const taskFlavor = toFlavorTaskName(flavor);
  const releaseTask =
    artifact === "bundle"
      ? `bundle${taskFlavor}Release`
      : `assemble${taskFlavor}Release`;
  const debugTask =
    artifact === "bundle"
      ? `bundle${taskFlavor}Debug`
      : `assemble${taskFlavor}Debug`;

  const replacements: Record<BuildType, Array<[RegExp, string]>> = {
    development: [
      [/\bassembleDebug\b/g, debugTask],
      [/\bbundleDebug\b/g, debugTask]
    ],
    adhoc: [
      [/\bassembleRelease\b/g, releaseTask],
      [/\bbundleRelease\b/g, releaseTask]
    ],
    store: [
      [/\bassembleRelease\b/g, releaseTask],
      [/\bbundleRelease\b/g, releaseTask]
    ]
  };

  let updated = command;
  for (const [pattern, replacement] of replacements[buildType]) {
    updated = updated.replace(pattern, replacement);
  }

  return updated;
}

function applyIosFlavorToCommand(command: string, schemeName: string): string {
  if (
    command.includes("{{FLAVOR") ||
    command.includes("{{FLAVOR_NAME") ||
    command.includes("{{FLAVOR_VALUE") ||
    command.includes("{{FLAVOR_TASK")
  ) {
    return command;
  }

  if (/\s-scheme\s+/.test(command)) {
    return command.replace(/(\s-scheme\s+)([^\s]+)/, `$1${schemeName}`);
  }

  return `${command} -scheme ${schemeName}`;
}

function looksLikePath(value: string): boolean {
  return value.includes("/") || value.includes("\\") || value.startsWith(".");
}

async function resolveOutputFolder(projectDir: string, outputHint?: string): Promise<string | undefined> {
  if (!outputHint || !looksLikePath(outputHint)) {
    return undefined;
  }

  const fullPath = path.resolve(projectDir, outputHint);
  if (await fs.pathExists(fullPath)) {
    const stat = await fs.stat(fullPath);
    return stat.isDirectory() ? fullPath : path.dirname(fullPath);
  }

  const parent = path.dirname(fullPath);
  if (await fs.pathExists(parent)) {
    return parent;
  }

  return undefined;
}

async function openFolder(folderPath: string): Promise<void> {
  if (process.platform === "darwin") {
    await execa("open", [folderPath]);
    return;
  }

  if (process.platform === "win32") {
    await execa("explorer", [folderPath]);
    return;
  }

  await execa("xdg-open", [folderPath]);
}

function augmentCommandForFastTrack(command: string, platform: Platform): string {
  if (platform === "android" && command.includes("gradlew")) {
    const gradleFlags = [
      "--parallel",
      "--build-cache",
      "-Dorg.gradle.daemon=true",
      "-Dorg.gradle.configureondemand=true"
    ];

    let updated = command;
    for (const flag of gradleFlags) {
      if (!updated.includes(flag)) {
        updated += ` ${flag}`;
      }
    }

    return updated;
  }

  if (platform === "ios" && command.includes("xcodebuild")) {
    const cpuCount = Math.max(2, os.cpus().length);
    const xcodeFlags = [
      "-parallelizeTargets",
      `-jobs ${cpuCount}`,
      "COMPILER_INDEX_STORE_ENABLE=NO"
    ];

    let updated = command;
    for (const flag of xcodeFlags) {
      if (!updated.includes(flag)) {
        updated += ` ${flag}`;
      }
    }

    return updated;
  }

  return command;
}


export async function runBuildCommand(options: BuildOptions): Promise<void> {
  const projectDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const config = await loadConfig(projectDir);

  const envNames = Object.keys(config.environments);
  if (envNames.length === 0) {
    throw new Error("No environments configured.");
  }

  if (!config.defaultEnvironment) {
    throw new Error(
      "defaultEnvironment is missing in .rnbuildrc.yml. Set it before archiving/building."
    );
  }

  if (!config.environments[config.defaultEnvironment]) {
    throw new Error(
      `defaultEnvironment '${config.defaultEnvironment}' is not configured in environments.`
    );
  }

  intro(pc.bold(pc.cyan("RN Build Helper")));

  const selectedEnv = options.env
    ? options.env
    : (await select({
        message: "Choose environment",
        options: envNames.map((name) => ({ value: name, label: name })),
        initialValue: config.defaultEnvironment
      }));
  if (isCancel(selectedEnv)) {
    outro(pc.yellow("Build cancelled."));
    return;
  }

  const selectedType = options.type
    ? asBuildType(options.type)
    : (await select({
        message: "Choose build type",
        options: BUILD_TYPES.map((value) => ({ value, label: value }))
      }));
  if (isCancel(selectedType)) {
    outro(pc.yellow("Build cancelled."));
    return;
  }

  const selectedPlatform = options.platform
    ? asPlatform(options.platform)
    : (await select({
        message: "Choose platform",
        options: PLATFORMS.map((value) => ({ value, label: value }))
      }));
  if (isCancel(selectedPlatform)) {
    outro(pc.yellow("Build cancelled."));
    return;
  }

  const platformFlavorConfig = config.flavors?.[selectedPlatform as Platform];
  if (options.flavor && !platformFlavorConfig) {
    throw new Error(`No flavors configured for ${selectedPlatform}.`);
  }
  const selectedFlavor = platformFlavorConfig
    ? options.flavor
      ? options.flavor
      : (await select({
          message: `Choose ${selectedPlatform} flavor`,
          options: platformFlavorConfig.options.map((name) => ({ value: name, label: name })),
          initialValue: platformFlavorConfig.default ?? platformFlavorConfig.options[0]
        }))
    : undefined;
  if (isCancel(selectedFlavor)) {
    outro(pc.yellow("Build cancelled."));
    return;
  }
  if (options.flavor && platformFlavorConfig && !platformFlavorConfig.options.includes(options.flavor)) {
    throw new Error(
      `Flavor '${options.flavor}' is not configured for ${selectedPlatform}.`
    );
  }
  const resolvedFlavor = resolveFlavorValue(
    platformFlavorConfig?.commandMap,
    selectedFlavor as string | undefined
  );

  const envConfig = config.environments[selectedEnv as string];
  if (!envConfig) {
    throw new Error(`Environment '${selectedEnv}' is not configured.`);
  }

  const profile = config.builds[selectedType as BuildType];
  const target = profile[selectedPlatform as Platform];
  if (!target || !target.enabled || !target.command) {
    throw new Error(
      `Build target not enabled for ${selectedType}/${selectedPlatform}. Update .rnbuildrc.yml first.`
    );
  }

  let selectedAndroidArtifact: AndroidArtifact = "apk";
  if (selectedPlatform === "android") {
    if (options.androidArtifact) {
      selectedAndroidArtifact = asAndroidArtifact(options.androidArtifact);
    } else if (target.androidArtifact) {
      selectedAndroidArtifact = target.androidArtifact;
    } else if (selectedType === "development") {
      selectedAndroidArtifact = "apk";
    } else {
      const artifactInput = await select({
        message: "Choose Android artifact",
        options: [
          { value: "apk", label: "apk" },
          { value: "bundle", label: "bundle (aab)" }
        ],
        initialValue: selectedType === "store" ? "bundle" : "apk"
      });
      if (isCancel(artifactInput)) {
        outro(pc.yellow("Build cancelled."));
        return;
      }
      selectedAndroidArtifact = artifactInput as AndroidArtifact;
    }
  }

  const envFilePath = envConfig.envFile ? path.resolve(projectDir, envConfig.envFile) : "";
  const envFileVars = envConfig.envFile ? await readDotEnv(envFilePath) : {};
  const runtimeVars = createRuntimeVars({
    envName: selectedEnv as string,
    buildType: selectedType as BuildType,
    platform: selectedPlatform as Platform,
    flavor: selectedFlavor as string | undefined,
    envFileVars,
    envConfigVars: envConfig.vars ?? {}
  });

  const mergedVars: Record<string, string> = {
    ...runtimeVars,
    PROJECT_NAME: config.projectName,
    ENV_NAME: selectedEnv as string,
    BUILD_TYPE: selectedType as BuildType,
    PLATFORM: selectedPlatform as Platform,
    ANDROID_ARTIFACT: selectedAndroidArtifact,
    FLAVOR: (selectedFlavor as string | undefined) ?? "",
    FLAVOR_NAME: (selectedFlavor as string | undefined) ?? "",
    FLAVOR_VALUE: resolvedFlavor,
    FLAVOR_TASK: resolvedFlavor ? toFlavorTaskName(resolvedFlavor) : "",
    ANDROID_TASK:
      selectedPlatform === "android"
        ? (selectedAndroidArtifact === "bundle" ? "bundle" : "assemble") +
          (resolvedFlavor ? toFlavorTaskName(resolvedFlavor) : "") +
          (selectedType === "development" ? "Debug" : "Release")
        : ""
  };

  const interpolatedCommand = interpolate(target.command, mergedVars);
  const androidCommandWithArtifact =
    selectedPlatform === "android"
      ? applyAndroidArtifactToCommand(
          interpolatedCommand,
          selectedType as BuildType,
          selectedAndroidArtifact
        )
      : interpolatedCommand;
  const command =
    selectedPlatform === "android" && resolvedFlavor
      ? applyAndroidFlavorToCommand(
          androidCommandWithArtifact,
          selectedType as BuildType,
          resolvedFlavor,
          selectedAndroidArtifact
        )
      : selectedPlatform === "ios" && resolvedFlavor
        ? applyIosFlavorToCommand(androidCommandWithArtifact, resolvedFlavor)
        : androidCommandWithArtifact;
  const finalCommand = options.fast
    ? augmentCommandForFastTrack(command, selectedPlatform as Platform)
    : command;
  const outputHint = target.outputHint
    ? resolveAndroidOutputHint(
        interpolate(target.outputHint, mergedVars),
        selectedType as BuildType,
        selectedAndroidArtifact
      )
    : undefined;

  console.log(pc.gray(`Project: ${projectDir}`));
  console.log(pc.gray(`Environment: ${selectedEnv}`));
  console.log(pc.gray(`Build: ${selectedType}/${selectedPlatform}`));
  if (selectedPlatform === "android") {
    console.log(pc.gray(`Android artifact: ${selectedAndroidArtifact}`));
  }
  if (selectedFlavor) {
    console.log(pc.gray(`Flavor: ${selectedFlavor}`));
  }
  console.log(pc.gray(`Command: ${finalCommand}`));
  console.log(pc.gray(`Logs: ${options.rawLogs ? "raw" : "pretty"}`));
  if (options.fast) {
    console.log(pc.cyan("Fast mode: enabled (incremental/cached flags applied where possible)"));
  }
  console.log("");

  if (options.dryRun) {
    outro(pc.yellow("Dry run complete. Command not executed."));
    return;
  }

  const shouldRun = await confirm({
    message: "Run this build command now?",
    initialValue: true
  });
  if (isCancel(shouldRun) || !shouldRun) {
    outro(pc.yellow("Build cancelled."));
    return;
  }

  const s = spinner();
  s.start(`Running ${selectedType}/${selectedPlatform} build...`);
  try {
    const runtimeArtifacts = await writeRuntimeEnvExports(
      projectDir,
      selectedEnv as string,
      runtimeVars
    );

    const logsDir = path.join(projectDir, ".rnbuild", "logs");
    const logPath = path.join(logsDir, `build-${Date.now()}.log`);

    await runCommandWithLogs({
      command: finalCommand,
      cwd: projectDir,
      rawLogs: Boolean(options.rawLogs),
      logToFilePath: logPath,
      pretty: true,
      env: {
        ...process.env,
        ...mergedVars,
        ENVFILE: runtimeArtifacts.runtimeEnvFilePath,
        RNBUILD_FAST: options.fast ? "1" : "0"
      }
    });
    s.stop(pc.green("Build command completed."));
    console.log(pc.gray(`Full logs saved to: ${logPath}`));
    console.log(pc.gray(`ENVFILE: ${runtimeArtifacts.runtimeEnvFilePath}`));
    console.log(pc.gray(`App config wrapper: ${runtimeArtifacts.runtimeWrapperPath}`));
    if (runtimeArtifacts.androidJsonPath) {
      console.log(pc.gray(`Android native JSON: ${runtimeArtifacts.androidJsonPath}`));
    }
    if (runtimeArtifacts.androidXmlPath) {
      console.log(pc.gray(`Android native XML: ${runtimeArtifacts.androidXmlPath}`));
    }
    if (runtimeArtifacts.iosInfoPlistPaths.length > 0) {
      console.log(pc.gray(`iOS Info.plist updated: ${runtimeArtifacts.iosInfoPlistPaths.length} file(s)`));
    }
  } catch (error) {
    s.stop(pc.red("Build command failed."));
    throw error;
  }

  if (outputHint) {
    console.log(pc.green(`Expected output: ${outputHint}`));

    const outputFolder = await resolveOutputFolder(projectDir, outputHint);
    if (outputFolder) {
      try {
        await openFolder(outputFolder);
        console.log(pc.green(`Opened output folder: ${outputFolder}`));
      } catch {
        console.log(pc.yellow(`Build succeeded but could not open folder: ${outputFolder}`));
      }
    }
  }

  outro(pc.bold(pc.green("Done.")));
}
