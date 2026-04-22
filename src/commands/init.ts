import path from "node:path";
import { intro, outro } from "@clack/prompts";
import pc from "picocolors";
import fs from "fs-extra";

import { CONFIG_FILE, writeConfig } from "../utils/config.js";
import { readDotEnv } from "../utils/env.js";
import { detectEnvironmentsFromDotEnv } from "../utils/environment-detection.js";
import { detectAndroidFlavors, detectIosSchemes } from "../utils/flavor-detection.js";
import { syncRuntimeEnvFromConfig } from "../utils/sync-runtime-env.js";
import type { RNBuildConfig } from "../types.js";

function createDefaultConfig(projectName = "my-rn-app"): RNBuildConfig {
  return {
    projectName,
    defaultEnvironment: "",
    environments: {},
    builds: {
      development: {
        android: {
          enabled: true,
          androidArtifact: "apk",
          command: "cd android && ./gradlew assembleDebug",
          outputHint: "android/app/build/outputs/apk/debug/app-debug.apk"
        },
        ios: {
          enabled: true,
          command:
            "xcodebuild -workspace ios/{{PROJECT_NAME}}.xcworkspace -scheme {{PROJECT_NAME}} -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build",
          outputHint: "ios/build"
        }
      },
      adhoc: {
        android: {
          enabled: true,
          androidArtifact: "apk",
          command: "cd android && ./gradlew assembleRelease",
          outputHint: "android/app/build/outputs/apk/release/app-release.apk"
        },
        ios: {
          enabled: true,
          command:
            "xcodebuild -workspace ios/{{PROJECT_NAME}}.xcworkspace -scheme {{PROJECT_NAME}} -configuration Release -archivePath ios/build/{{PROJECT_NAME}}.xcarchive archive",
          outputHint: "ios/build/{{PROJECT_NAME}}.xcarchive"
        }
      },
      store: {
        android: {
          enabled: true,
          androidArtifact: "bundle",
          command: "cd android && ./gradlew bundleRelease",
          outputHint: "android/app/build/outputs/bundle/release/app-release.aab"
        },
        ios: {
          enabled: true,
          command:
            "xcodebuild -workspace ios/{{PROJECT_NAME}}.xcworkspace -scheme {{PROJECT_NAME}} -configuration Release -archivePath ios/build/{{PROJECT_NAME}}.xcarchive archive",
          outputHint: "Use xcodebuild -exportArchive with your App Store export options"
        }
      }
    }
  };
}

async function detectProjectName(projectDir: string, explicitProjectName?: string): Promise<string> {
  if (explicitProjectName?.trim()) {
    return explicitProjectName.trim();
  }

  const iosSchemes = await detectIosSchemes(projectDir);
  if (iosSchemes?.default) {
    return iosSchemes.default;
  }

  const packageJsonPath = path.join(projectDir, "package.json");
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const packageJson = await fs.readJson(packageJsonPath);
      const rawName = String(packageJson.name ?? "").trim();
      if (rawName) {
        return rawName.replace(/^@[^/]+\//, "");
      }
    } catch {
      // Ignore invalid package.json and continue to fallback.
    }
  }

  return path.basename(projectDir) || "my-rn-app";
}

async function detectOrCreateEnvironments(projectDir: string): Promise<RNBuildConfig["environments"]> {
  const detected = await detectEnvironmentsFromDotEnv(projectDir);
  if (Object.keys(detected).length > 0) {
    return detected;
  }

  const rootEnvFile = path.join(projectDir, ".env");
  const hasRootEnv = await fs.pathExists(rootEnvFile);

  return {
    development: {
      envFile: hasRootEnv ? ".env" : undefined,
      vars: hasRootEnv ? await readDotEnv(rootEnvFile) : {}
    }
  };
}

export async function runInitCommand(options: { force: boolean; projectName?: string }): Promise<void> {
  const cwd = process.cwd();
  const configPath = path.join(cwd, CONFIG_FILE);
  const exists = await fs.pathExists(configPath);

  if (exists && !options.force) {
    throw new Error(`${CONFIG_FILE} already exists. Use --force to overwrite.`);
  }

  intro(pc.bold(pc.cyan("RN Build Helper Setup")));

  const projectName = await detectProjectName(cwd, options.projectName);
  const config: RNBuildConfig = createDefaultConfig(projectName);

  config.environments = await detectOrCreateEnvironments(cwd);
  config.defaultEnvironment = Object.keys(config.environments).includes("development")
    ? "development"
    : Object.keys(config.environments)[0];

  const androidFlavors = await detectAndroidFlavors(cwd);
  const iosFlavors = await detectIosSchemes(cwd, projectName);

  if (androidFlavors || iosFlavors) {
    config.flavors = {
      ...(androidFlavors ? { android: androidFlavors } : {}),
      ...(iosFlavors ? { ios: iosFlavors } : {})
    };
  }

  console.log(pc.gray(`Detected project name: ${projectName}`));
  console.log(pc.gray(`Detected environments: ${Object.keys(config.environments).join(", ")}`));
  if (androidFlavors) {
    console.log(pc.gray(`Detected Android flavors: ${androidFlavors.options.join(", ")}`));
  }
  if (iosFlavors) {
    console.log(pc.gray(`Detected iOS schemes: ${iosFlavors.options.join(", ")}`));
  }

  const writtenPath = await writeConfig(cwd, config);
  await syncRuntimeEnvFromConfig(cwd, config);

  outro(pc.green(`Created ${writtenPath}. Edit ${CONFIG_FILE} any time.`));
}
