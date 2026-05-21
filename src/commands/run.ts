import path from "node:path";
import { confirm, intro, isCancel, outro, select } from "@clack/prompts";
import pc from "picocolors";
import { execa } from "execa";

import { loadConfig } from "../utils/config.js";
import { interpolate, readDotEnv } from "../utils/env.js";
import { createRuntimeVars, writeRuntimeEnvExports } from "../utils/runtime-exports.js";
import { asPlatform } from "../utils/validation.js";
import { resolveFlavorValue, toFlavorTaskName } from "../utils/flavor.js";
import { runCommandWithLogs } from "../utils/exec.js";
import { PLATFORMS, type Platform } from "../types.js";

interface RunOptions {
  env?: string;
  platform?: string;
  flavor?: string;
  cwd?: string;
  rawLogs?: boolean;
  noPackager?: boolean;
}

class RunCommandError extends Error {
  readonly hints: string[];

  constructor(message: string, hints: string[] = []) {
    super(message);
    this.name = "RunCommandError";
    this.hints = hints;
  }
}


function buildRunCommand(params: {
  platform: Platform;
  flavorValue?: string;
  noPackager?: boolean;
}): string {
  if (params.platform === "android") {
    const mode = params.flavorValue ? `${toFlavorTaskName(params.flavorValue)}Debug` : "debug";
    return `npx react-native run-android --mode ${mode}${params.noPackager ? " --no-packager" : ""}`;
  }

  const schemeFlag = params.flavorValue ? ` --scheme ${params.flavorValue}` : "";
  return `npx react-native run-ios${schemeFlag}${params.noPackager ? " --no-packager" : ""}`;
}


function analyzeRunFailure(lines: string[], platform: Platform | "unknown"): string[] {
  if (platform !== "ios") {
    return [];
  }

  const hasReactNativeConfigModuleError = lines.some(
    (line) =>
      /non-modular-include-in-framework-module/.test(line) &&
      /(GeneratedDotEnv\.m|RNCConfig\.m)/.test(line)
  );

  if (!hasReactNativeConfigModuleError) {
    return [];
  }

  return [
    "Detected react-native-config native iOS sources (`GeneratedDotEnv.m`, `RNCConfig.m`) failing to compile.",
    "If you are migrating to react-native-build-orchestrator for env access, remove `react-native-config` from the consumer app, run `cd ios && pod install`, then clean DerivedData / Xcode build folder.",
    "If the app still uses `react-native-config` natively, this is an iOS integration issue in the consumer app rather than a react-native-build-orchestrator run command issue."
  ];
}


export async function runAppCommand(options: RunOptions): Promise<void> {
  const projectDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const config = await loadConfig(projectDir);

  if (!config.defaultEnvironment || !config.environments[config.defaultEnvironment]) {
    throw new Error("A valid defaultEnvironment is required before running for debug.");
  }

  const envNames = Object.keys(config.environments);
  const selectedEnv = options.env
    ? options.env
    : (await select({
        message: "Choose environment",
        options: envNames.map((name) => ({ value: name, label: name })),
        initialValue: config.defaultEnvironment
      }));
  if (isCancel(selectedEnv)) {
    outro(pc.yellow("Run cancelled."));
    return;
  }

  const selectedPlatform = options.platform
    ? asPlatform(options.platform)
    : (await select({
        message: "Choose platform",
        options: PLATFORMS.map((value) => ({ value, label: value }))
      }));
  if (isCancel(selectedPlatform)) {
    outro(pc.yellow("Run cancelled."));
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
    outro(pc.yellow("Run cancelled."));
    return;
  }
  if (options.flavor && platformFlavorConfig && !platformFlavorConfig.options.includes(options.flavor)) {
    throw new Error(`Flavor '${options.flavor}' is not configured for ${selectedPlatform}.`);
  }

  const envConfig = config.environments[selectedEnv as string];
  if (!envConfig) {
    throw new Error(`Environment '${selectedEnv}' is not configured.`);
  }

  const resolvedFlavor = resolveFlavorValue(
    platformFlavorConfig?.commandMap,
    selectedFlavor as string | undefined
  );

  const envFilePath = envConfig.envFile ? path.resolve(projectDir, envConfig.envFile) : "";
  const envFileVars = envConfig.envFile ? await readDotEnv(envFilePath) : {};
  const runtimeVars = createRuntimeVars({
    envName: selectedEnv as string,
    buildType: "development",
    platform: selectedPlatform as Platform,
    flavor: selectedFlavor as string | undefined,
    envFileVars,
    envConfigVars: envConfig.vars ?? {}
  });

  const mergedVars: Record<string, string> = {
    ...runtimeVars,
    PROJECT_NAME: config.projectName,
    ENV_NAME: selectedEnv as string,
    BUILD_TYPE: "development",
    PLATFORM: selectedPlatform as Platform,
    FLAVOR: (selectedFlavor as string | undefined) ?? "",
    FLAVOR_NAME: (selectedFlavor as string | undefined) ?? "",
    FLAVOR_VALUE: resolvedFlavor,
    FLAVOR_TASK: resolvedFlavor ? toFlavorTaskName(resolvedFlavor) : ""
  };

  const runCommand = interpolate(
    buildRunCommand({
      platform: selectedPlatform as Platform,
      flavorValue: resolvedFlavor || undefined,
      noPackager: options.noPackager
    }),
    mergedVars
  );

  intro(pc.bold(pc.cyan("RN Build Helper Run")));
  console.log(pc.gray(`Project: ${projectDir}`));
  console.log(pc.gray(`Environment: ${selectedEnv}`));
  console.log(pc.gray(`Platform: ${selectedPlatform}`));
  if (selectedFlavor) {
    console.log(pc.gray(`Flavor: ${selectedFlavor}`));
  }
  console.log(pc.gray(`Command: ${runCommand}`));
  console.log("");

  const shouldRun = await confirm({
    message: "Run app in debug mode now?",
    initialValue: true
  });
  if (isCancel(shouldRun) || !shouldRun) {
    outro(pc.yellow("Run cancelled."));
    return;
  }

  const runtimeArtifacts = await writeRuntimeEnvExports(projectDir, selectedEnv as string, runtimeVars);

  console.log(pc.bold(pc.cyan(`\n  Starting ${selectedPlatform} debug build…`)));
  console.log(pc.gray(`  ${runCommand}\n`));
  try {
    const rawLines: string[] = [];

    try {
      await runCommandWithLogs({
        command: runCommand,
        cwd: projectDir,
        rawLogs: Boolean(options.rawLogs),
        onLine: (line) => rawLines.push(line),
        platform: selectedPlatform as Platform,
        env: {
          ...process.env,
          ...mergedVars,
          ENVFILE: runtimeArtifacts.runtimeEnvFilePath
        }
      });
    } catch {
      throw new RunCommandError(
        "Run command failed.",
        analyzeRunFailure(rawLines, selectedPlatform as Platform)
      );
    }
    console.log("");
    console.log(pc.green("  ✓ Debug run completed."));
    console.log(pc.gray(`  ENVFILE: ${runtimeArtifacts.runtimeEnvFilePath}`));
    console.log(pc.gray(`  Config:  ${runtimeArtifacts.runtimeWrapperPath}`));
    if (runtimeArtifacts.androidJsonPath) {
      console.log(pc.gray(`  Android native JSON: ${runtimeArtifacts.androidJsonPath}`));
    }
    if (runtimeArtifacts.androidXmlPath) {
      console.log(pc.gray(`  Android native XML: ${runtimeArtifacts.androidXmlPath}`));
    }
    if (runtimeArtifacts.iosInfoPlistPaths.length > 0) {
      console.log(pc.gray(`  iOS Info.plist updated: ${runtimeArtifacts.iosInfoPlistPaths.length} file(s)`));
    }
  } catch (error) {
    console.log("");
    console.log(pc.red("  ✗ Debug run failed."));
    if (error instanceof RunCommandError && error.hints.length > 0) {
      console.log("");
      console.log(pc.bold(pc.yellow("  Likely cause")));
      for (const hint of error.hints) {
        console.log(pc.yellow(`  - ${hint}`));
      }
    }
    throw error;
  }

  outro(pc.bold(pc.green("Done.")));
}