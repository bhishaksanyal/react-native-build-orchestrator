import path from "node:path";
import { confirm, intro, isCancel, outro, select, spinner, text } from "@clack/prompts";
import pc from "picocolors";
import { execa } from "execa";

import { loadConfig } from "../utils/config.js";
import { interpolate, readDotEnv } from "../utils/env.js";
import { createRuntimeVars, writeRuntimeEnvExports } from "../utils/runtime-exports.js";
import { PLATFORMS, type Platform } from "../types.js";

interface UploadOptions {
  env?: string;
  platform?: string;
  flavor?: string;
  lane?: string;
  track?: string;
  artifactType?: string;
  artifactPath?: string;
  cwd?: string;
  rawLogs?: boolean;
}

function toFastlaneOption(key: string, value: string): string {
  return `${key}:${JSON.stringify(value)}`;
}

function asPlatform(input: string): Platform {
  if (!PLATFORMS.includes(input as Platform)) {
    throw new Error(`Invalid platform '${input}'. Use: ${PLATFORMS.join(", ")}`);
  }
  return input as Platform;
}

function resolveFlavorValue(
  commandMap: Record<string, string> | undefined,
  selectedFlavor: string | undefined
): string {
  if (!selectedFlavor) {
    return "";
  }
  return commandMap?.[selectedFlavor] ?? selectedFlavor;
}

function styleLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return "";
  }

  if (
    trimmed.includes("error") ||
    trimmed.includes("failed") ||
    trimmed.includes("FAIL") ||
    trimmed.includes("[!] ")
  ) {
    return pc.red(`  ${trimmed}`);
  }

  if (
    trimmed.includes("warning") ||
    trimmed.includes("deprecated") ||
    trimmed.includes("warn")
  ) {
    return pc.yellow(`  ${trimmed}`);
  }

  if (
    trimmed.includes("Uploading") ||
    trimmed.includes("Successfully") ||
    trimmed.includes("finished")
  ) {
    return pc.green(`  ${trimmed}`);
  }

  return pc.gray(`  ${trimmed}`);
}

async function runCommandWithLogs(params: {
  command: string;
  cwd: string;
  env: Record<string, string | undefined>;
  rawLogs: boolean;
}): Promise<void> {
  const child = execa(params.command, {
    cwd: params.cwd,
    shell: true,
    env: params.env,
    all: true,
    reject: false
  });

  let pending = "";
  if (child.all) {
    for await (const chunk of child.all) {
      const text = chunk.toString();
      pending += text;

      while (pending.includes("\n")) {
        const newlineIndex = pending.indexOf("\n");
        const line = pending.slice(0, newlineIndex).replace(/\r$/, "");
        pending = pending.slice(newlineIndex + 1);

        if (params.rawLogs) {
          console.log(line);
        } else {
          const styled = styleLine(line);
          if (styled) {
            console.log(styled);
          }
        }
      }
    }
  }

  if (pending.trim()) {
    if (params.rawLogs) {
      console.log(pending);
    } else {
      const styled = styleLine(pending);
      if (styled) {
        console.log(styled);
      }
    }
  }

  const result = await child;
  if (result.exitCode !== 0) {
    throw new Error("Fastlane upload failed.");
  }
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

export async function runUploadCommand(options: UploadOptions): Promise<void> {
  const projectDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const config = await loadConfig(projectDir);

  if (!config.defaultEnvironment || !config.environments[config.defaultEnvironment]) {
    throw new Error("A valid defaultEnvironment is required before upload.");
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
    outro(pc.yellow("Upload cancelled."));
    return;
  }

  const selectedPlatform = options.platform
    ? asPlatform(options.platform)
    : (await select({
        message: "Choose platform",
        options: PLATFORMS.map((value) => ({ value, label: value }))
      }));
  if (isCancel(selectedPlatform)) {
    outro(pc.yellow("Upload cancelled."));
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
    outro(pc.yellow("Upload cancelled."));
    return;
  }

  if (options.flavor && platformFlavorConfig && !platformFlavorConfig.options.includes(options.flavor)) {
    throw new Error(`Flavor '${options.flavor}' is not configured for ${platform}.`);
  }

  const laneInput = options.lane
    ? options.lane
    : (await text({
        message: `Fastlane lane for ${platform}`,
        defaultValue:
          config.fastlane?.[platform]?.lane ??
          "upload_store",
        placeholder: "upload_store"
      }));
  if (isCancel(laneInput)) {
    outro(pc.yellow("Upload cancelled."));
    return;
  }
  const lane = String(laneInput).trim();
  if (!lane) {
    throw new Error("Fastlane lane cannot be empty.");
  }

  const defaultTrack =
    config.fastlane?.[platform]?.defaultTrack ??
    (platform === "android" ? "internal" : "testflight");

  const trackInput = options.track
    ? options.track
    : (await text({
        message: `Track / destination for ${platform}`,
        defaultValue: defaultTrack,
        placeholder: defaultTrack
      }));
  if (isCancel(trackInput)) {
    outro(pc.yellow("Upload cancelled."));
    return;
  }
  const track = String(trackInput).trim();

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
    buildType: "store",
    platform,
    flavor: selectedFlavor as string | undefined,
    envFileVars,
    envConfigVars: envConfig.vars ?? {}
  });

  const mergedVars: Record<string, string> = {
    ...runtimeVars,
    PROJECT_NAME: config.projectName,
    ENV_NAME: selectedEnv as string,
    BUILD_TYPE: "store",
    PLATFORM: platform,
    FLAVOR: (selectedFlavor as string | undefined) ?? "",
    FLAVOR_NAME: (selectedFlavor as string | undefined) ?? "",
    FLAVOR_VALUE: resolvedFlavor
  };

  const fastlaneRunner = await resolveFastlaneRunner(projectDir);
  const commandParts = [`${fastlaneRunner} ${platform} ${lane}`];
  if (track) {
    commandParts.push(toFastlaneOption("track", track));
  }
  if (options.artifactType) {
    commandParts.push(toFastlaneOption("artifact_type", options.artifactType));
  }
  if (options.artifactPath) {
    commandParts.push(toFastlaneOption("artifact_path", options.artifactPath));
  }

  const uploadCommand = interpolate(
    commandParts.join(" "),
    mergedVars
  );

  intro(pc.bold(pc.cyan("RN Build Helper Upload")));
  console.log(pc.gray(`Project: ${projectDir}`));
  console.log(pc.gray(`Environment: ${selectedEnv}`));
  console.log(pc.gray(`Platform: ${platform}`));
  if (selectedFlavor) {
    console.log(pc.gray(`Flavor: ${selectedFlavor}`));
  }
  console.log(pc.gray(`Lane: ${lane}`));
  console.log(pc.gray(`Track: ${track || "(none)"}`));
  if (options.artifactType) {
    console.log(pc.gray(`Artifact type: ${options.artifactType}`));
  }
  if (options.artifactPath) {
    console.log(pc.gray(`Artifact path: ${options.artifactPath}`));
  }
  console.log(pc.gray(`Command: ${uploadCommand}`));
  console.log("");

  const shouldRun = await confirm({
    message: "Run Fastlane upload now?",
    initialValue: true
  });
  if (isCancel(shouldRun) || !shouldRun) {
    outro(pc.yellow("Upload cancelled."));
    return;
  }

  const runtimeArtifacts = await writeRuntimeEnvExports(projectDir, selectedEnv as string, runtimeVars);

  const s = spinner();
  s.start(`Running fastlane ${platform} ${lane}...`);
  try {
    await runCommandWithLogs({
      command: uploadCommand,
      cwd: projectDir,
      rawLogs: Boolean(options.rawLogs),
      env: {
        ...process.env,
        ...mergedVars,
        FASTLANE_TRACK: track,
        FASTLANE_ARTIFACT_TYPE: options.artifactType,
        FASTLANE_ARTIFACT_PATH: options.artifactPath,
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

  outro(pc.bold(pc.green("Done.")));
}
