import path from "node:path";
import fs from "fs-extra";
import { confirm, intro, isCancel, outro, select, spinner, text } from "@clack/prompts";
import pc from "picocolors";
import { execa } from "execa";

import { runBuildCommand } from "./build.js";
import { loadConfig } from "../utils/config.js";
import { createRuntimeVars, writeRuntimeEnvExports } from "../utils/runtime-exports.js";
import { interpolate, readDotEnv } from "../utils/env.js";
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

interface ReleaseOptions {
  env?: string;
  platform?: string;
  flavor?: string;
  type?: string;
  androidArtifact?: string;
  iosArtifact?: string;
  artifactPath?: string;
  lane?: string;
  track?: string;
  cwd?: string;
  fast?: boolean;
  rawLogs?: boolean;
  dryRun?: boolean;
  ci?: boolean;
}

function toFastlaneOption(key: string, value: string): string {
  return `${key}:${JSON.stringify(value)}`;
}

async function resolveFastlaneRunner(projectDir: string): Promise<string> {
  try {
    await execa("bundle exec fastlane --version", {
      cwd: projectDir,
      shell: true,
      reject: true
    });
    return "bundle exec fastlane";
  } catch {
    return "fastlane";
  }
}


async function promptTrack(platform: Platform, defaultTrack: string): Promise<string> {
  if (platform === "android") {
    const selected = await select({
      message: "Choose Android track",
      options: [
        { value: "internal", label: "internal" },
        { value: "alpha", label: "alpha" },
        { value: "beta", label: "beta" },
        { value: "production", label: "production" },
        { value: "__custom__", label: "custom" }
      ],
      initialValue: ["internal", "alpha", "beta", "production"].includes(defaultTrack)
        ? defaultTrack
        : "__custom__"
    });

    if (isCancel(selected)) {
      throw new Error("cancelled-by-user");
    }

    if (selected !== "__custom__") {
      return String(selected);
    }
  } else {
    const selected = await select({
      message: "Choose iOS destination",
      options: [
        { value: "testflight", label: "testflight" },
        { value: "app_store", label: "app_store" },
        { value: "__custom__", label: "custom" }
      ],
      initialValue: ["testflight", "app_store"].includes(defaultTrack)
        ? defaultTrack
        : "__custom__"
    });

    if (isCancel(selected)) {
      throw new Error("cancelled-by-user");
    }

    if (selected !== "__custom__") {
      return String(selected);
    }
  }

  const custom = await text({
    message: "Custom track/destination",
    defaultValue: defaultTrack,
    placeholder: defaultTrack
  });
  if (isCancel(custom)) {
    throw new Error("cancelled-by-user");
  }
  const value = String(custom).trim();
  return value || defaultTrack;
}

export async function runReleaseCommand(options: ReleaseOptions): Promise<void> {
  const projectDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const config = await loadConfig(projectDir);

  if (!config.defaultEnvironment || !config.environments[config.defaultEnvironment]) {
    throw new Error("A valid defaultEnvironment is required before release.");
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
    outro(pc.yellow("Release cancelled."));
    return;
  }

  const selectedPlatform = options.platform
    ? asPlatform(options.platform)
    : (await select({
        message: "Choose platform",
        options: PLATFORMS.map((value) => ({ value, label: value }))
      }));
  if (isCancel(selectedPlatform)) {
    outro(pc.yellow("Release cancelled."));
    return;
  }

  const platform = selectedPlatform as Platform;
  const platformFlavorConfig = config.flavors?.[platform];
  if (options.flavor && !platformFlavorConfig) {
    throw new Error(`No flavors configured for ${platform}.`);
  }

  const selectedFlavor = platformFlavorConfig
    ? options.flavor
      ? options.flavor
      : (await select({
          message: `Choose ${platform} flavor`,
          options: platformFlavorConfig.options.map((name) => ({ value: name, label: name })),
          initialValue: platformFlavorConfig.default ?? platformFlavorConfig.options[0]
        }))
    : undefined;

  if (isCancel(selectedFlavor)) {
    outro(pc.yellow("Release cancelled."));
    return;
  }

  if (options.flavor && platformFlavorConfig && !platformFlavorConfig.options.includes(options.flavor)) {
    throw new Error(`Flavor '${options.flavor}' is not configured for ${platform}.`);
  }

  const selectedType = options.type
    ? asBuildType(options.type)
    : (await select({
        message: "Choose build type",
        options: BUILD_TYPES.map((value) => ({ value, label: value })),
        initialValue: "store"
      }));
  if (isCancel(selectedType)) {
    outro(pc.yellow("Release cancelled."));
    return;
  }

  const buildProfile = config.builds[selectedType as BuildType];
  const buildTarget = buildProfile?.[platform];
  if (!buildTarget?.enabled) {
    throw new Error(`Build target not enabled for ${selectedType}/${platform}.`);
  }

  let selectedAndroidArtifact: AndroidArtifact | undefined;
  let selectedIosArtifact: "ipa" | undefined;
  let uploadArtifactType: "apk" | "aab" | "ipa" | undefined;

  if (platform === "android") {
    if (options.androidArtifact) {
      selectedAndroidArtifact = asAndroidArtifact(options.androidArtifact);
    } else if (buildTarget.androidArtifact) {
      selectedAndroidArtifact = buildTarget.androidArtifact;
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
        outro(pc.yellow("Release cancelled."));
        return;
      }

      selectedAndroidArtifact = artifactInput as AndroidArtifact;
    }

    uploadArtifactType = selectedAndroidArtifact === "bundle" ? "aab" : "apk";
  } else {
    selectedIosArtifact = "ipa";
    uploadArtifactType = "ipa";
  }

  const defaultLane = config.fastlane?.[platform]?.lane ?? "upload_store";
  const laneInput = options.lane
    ? options.lane
    : (await text({
        message: `Fastlane lane for ${platform}`,
        defaultValue: defaultLane,
        placeholder: defaultLane
      }));
  if (isCancel(laneInput)) {
    outro(pc.yellow("Release cancelled."));
    return;
  }
  const selectedLane = String(laneInput).trim() || defaultLane;

  const defaultTrack =
    config.fastlane?.[platform]?.defaultTrack ?? (platform === "android" ? "internal" : "testflight");
  let selectedTrack = options.track;
  if (!selectedTrack) {
    try {
      selectedTrack = await promptTrack(platform, defaultTrack);
    } catch (error) {
      if (error instanceof Error && error.message === "cancelled-by-user") {
        outro(pc.yellow("Release cancelled."));
        return;
      }
      throw error;
    }
  }
  selectedTrack = selectedTrack.trim() || defaultTrack;

  const envConfig = config.environments[String(selectedEnv)];
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
    envName: String(selectedEnv),
    buildType: selectedType as BuildType,
    platform,
    flavor: selectedFlavor as string | undefined,
    envFileVars,
    envConfigVars: envConfig.vars ?? {}
  });

  const mergedVars: Record<string, string> = {
    ...runtimeVars,
    PROJECT_NAME: config.projectName,
    ENV_NAME: String(selectedEnv),
    BUILD_TYPE: selectedType as BuildType,
    PLATFORM: platform,
    FLAVOR: (selectedFlavor as string | undefined) ?? "",
    FLAVOR_NAME: (selectedFlavor as string | undefined) ?? "",
    FLAVOR_VALUE: resolvedFlavor,
    FLAVOR_TASK: resolvedFlavor ? toFlavorTaskName(resolvedFlavor) : "",
    ANDROID_ARTIFACT: selectedAndroidArtifact ?? "",
    IOS_ARTIFACT: selectedIosArtifact ?? ""
  };

  const interpolatedHint = buildTarget.outputHint
    ? interpolate(buildTarget.outputHint, mergedVars)
    : undefined;
  const expectedArtifactHint =
    platform === "android"
      ? resolveAndroidOutputHint(interpolatedHint, selectedType as BuildType, selectedAndroidArtifact ?? "apk")
      : interpolatedHint;

  let selectedArtifactPath = options.artifactPath;
  if (!selectedArtifactPath && expectedArtifactHint) {
    selectedArtifactPath = expectedArtifactHint;
  }

  intro(pc.bold(pc.cyan("RN Build Helper Release")));
  console.log(pc.gray(`Project: ${projectDir}`));
  console.log(pc.gray(`Environment: ${selectedEnv}`));
  console.log(pc.gray(`Platform: ${platform}`));
  if (selectedFlavor) {
    console.log(pc.gray(`Flavor: ${selectedFlavor}`));
  }
  console.log(pc.gray(`Build type: ${selectedType}`));
  console.log(pc.gray(`Lane: ${selectedLane}`));
  console.log(pc.gray(`Track: ${selectedTrack}`));
  if (uploadArtifactType) {
    console.log(pc.gray(`Upload artifact type: ${uploadArtifactType}`));
  }
  if (selectedArtifactPath) {
    console.log(pc.gray(`Expected artifact path: ${selectedArtifactPath}`));
  }
  if (options.dryRun) {
    console.log(pc.yellow("Dry run mode: build command will be previewed and upload will be skipped."));
  }
  console.log("");

  // Always build first
  await runBuildCommand({
    env: String(selectedEnv),
    type: selectedType as BuildType,
    platform,
    flavor: selectedFlavor as string | undefined,
    androidArtifact: selectedAndroidArtifact,
    cwd: projectDir,
    dryRun: Boolean(options.dryRun),
    fast: Boolean(options.fast),
    rawLogs: Boolean(options.rawLogs)
  });

  if (options.dryRun) {
    outro(pc.bold(pc.green("Release dry run complete.")));
    return;
  }

  if (!selectedArtifactPath) {
    const artifactPathInput = await text({
      message: `Path to ${uploadArtifactType ?? "build"} artifact for upload`,
      placeholder: platform === "android" ? "android/app/build/outputs/..." : "ios/build/... .ipa"
    });
    if (isCancel(artifactPathInput)) {
      outro(pc.yellow("Release cancelled."));
      return;
    }
    selectedArtifactPath = String(artifactPathInput).trim();
  }

  if (!selectedArtifactPath) {
    throw new Error("Artifact path is required for upload.");
  }

  const resolvedArtifactPath = path.isAbsolute(selectedArtifactPath)
    ? selectedArtifactPath
    : path.resolve(projectDir, selectedArtifactPath);

  if (!(await fs.pathExists(resolvedArtifactPath))) {
    throw new Error(`Artifact not found: ${resolvedArtifactPath}`);
  }

  // Upload phase
  const uploadEnvConfig = config.environments[String(selectedEnv)];
  if (!uploadEnvConfig) {
    throw new Error(`Environment '${selectedEnv}' is not configured.`);
  }

  const uploadEnvFilePath = uploadEnvConfig.envFile ? path.resolve(projectDir, uploadEnvConfig.envFile) : "";
  const uploadEnvFileVars = uploadEnvConfig.envFile ? await readDotEnv(uploadEnvFilePath) : {};

  const uploadRuntimeVars = createRuntimeVars({
    envName: String(selectedEnv),
    buildType: selectedType as BuildType,
    platform,
    flavor: selectedFlavor as string | undefined,
    envFileVars: uploadEnvFileVars,
    envConfigVars: uploadEnvConfig.vars ?? {}
  });

  const uploadMergedVars: Record<string, string> = {
    ...uploadRuntimeVars,
    PROJECT_NAME: config.projectName,
    ENV_NAME: String(selectedEnv),
    BUILD_TYPE: selectedType as BuildType,
    PLATFORM: platform,
    FLAVOR: (selectedFlavor as string | undefined) ?? "",
    FLAVOR_NAME: (selectedFlavor as string | undefined) ?? "",
    FLAVOR_VALUE: resolvedFlavor
  };

  const fastlaneRunner = await resolveFastlaneRunner(projectDir);
  const commandParts = [`${fastlaneRunner} ${platform} ${selectedLane}`];
  if (selectedTrack) {
    commandParts.push(toFastlaneOption("track", selectedTrack));
  }
  if (uploadArtifactType) {
    commandParts.push(toFastlaneOption("artifact_type", uploadArtifactType));
  }
  commandParts.push(toFastlaneOption("artifact_path", resolvedArtifactPath));

  const uploadCommand = interpolate(
    commandParts.join(" "),
    uploadMergedVars
  );

  console.log(pc.bold(pc.cyan("Upload Phase")));
  console.log(pc.gray(`Lane: ${selectedLane}`));
  console.log(pc.gray(`Track: ${selectedTrack}`));
  console.log(pc.gray(`Artifact: ${resolvedArtifactPath}`));
  console.log(pc.gray(`Command: ${uploadCommand}`));
  console.log("");

  if (!options.ci) {
    const shouldRun = await confirm({
      message: "Run Fastlane upload now?",
      initialValue: true
    });
    if (isCancel(shouldRun) || !shouldRun) {
      outro(pc.yellow("Upload cancelled."));
      return;
    }
  }

  const runtimeArtifacts = await writeRuntimeEnvExports(projectDir, String(selectedEnv), uploadRuntimeVars);

  const s = spinner();
  s.start(`Running fastlane ${platform} ${selectedLane}...`);
  try {
    await runCommandWithLogs({
      command: uploadCommand,
      cwd: projectDir,
      rawLogs: Boolean(options.rawLogs),
      errorMessage: "Fastlane upload failed.",
      env: {
        ...process.env,
        ...uploadMergedVars,
        FASTLANE_TRACK: selectedTrack,
        FASTLANE_ARTIFACT_TYPE: uploadArtifactType,
        FASTLANE_ARTIFACT_PATH: resolvedArtifactPath,
        ENVFILE: runtimeArtifacts.runtimeEnvFilePath
      }
    });
    s.stop(pc.green("Fastlane upload completed."));
    console.log(pc.gray(`ENVFILE: ${runtimeArtifacts.runtimeEnvFilePath}`));
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
    s.stop(pc.red("Fastlane upload failed."));
    throw error;
  }

  outro(pc.bold(pc.green("Release completed.")));
}
