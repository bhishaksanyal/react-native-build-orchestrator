#!/usr/bin/env node
import { program } from "commander";
import pc from "picocolors";

import pkg from "../package.json" with { type: "json" };
import { runInitCommand } from "./commands/init.js";
import { runBuildCommand } from "./commands/build.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runEnvCommand } from "./commands/env.js";
import { runFastlaneSetupCommand } from "./commands/fastlane.js";
import { runFlavorCommand } from "./commands/flavor.js";
import { runReleaseCommand } from "./commands/release.js";
import { runAppCommand } from "./commands/run.js";
import { runVersionCommand } from "./commands/version.js";
import { setCiMode, getCiMode, printJson } from "./utils/logger.js";

async function withErrorHandler(name: string, isCi: boolean | undefined, fn: () => Promise<any>) {
  try {
    if (isCi) setCiMode(true);
    const result = await fn();
    if (getCiMode() && result !== undefined) {
      printJson(result);
      if (result.status === "error") {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (getCiMode()) {
      printJson({ status: "error", command: name, message });
    } else {
      console.error(pc.red(`${name} failed: ${message}`));
    }
    process.exitCode = 1;
  }
}

program
  .name("rnbuild")
  .description("Standardized React Native environment management, flavor-aware builds, and store uploads")
  .version(pkg.version, "-V, --cli-version");

program
  .command("init")
  .description("Create a .rnbuildrc.yml configuration file")
  .option("--force", "Overwrite existing config")
  .option("--project-name <name>", "Set project name/scheme default")
  .option("--ci", "Run in CI mode with structured JSON output and no prompts")
  .action(async (options: { force?: boolean; projectName?: string; ci?: boolean }) => {
    await withErrorHandler("init", options.ci, () =>
      runInitCommand({
        force: Boolean(options.force),
        projectName: options.projectName
      })
    );
  });

program
  .command("build")
  .description("Run a configured Android/iOS build profile")
  .option("-e, --env <name>", "Environment name from config")
  .option("-t, --type <buildType>", "Build type: development | adhoc | store")
  .option("-p, --platform <platform>", "Platform: android | ios")
  .option("-f, --flavor <name>", "Optional platform flavor to build")
  .option("--android-artifact <type>", "Android output artifact: apk | bundle")
  .option("--cwd <path>", "Project path (defaults to current directory)")
  .option("--dry-run", "Show command without executing it")
  .option("--fast", "Apply platform fast-track flags for faster archives/builds")
  .option("--raw-logs", "Print raw build logs instead of styled output")
  .option("--ci", "Run in CI mode with structured JSON output and no prompts")
  .action(
    async (options: {
      env?: string;
      type?: string;
      platform?: string;
      flavor?: string;
      androidArtifact?: string;
      cwd?: string;
      dryRun?: boolean;
      fast?: boolean;
      rawLogs?: boolean;
      ci?: boolean;
    }) => {
      await withErrorHandler("build", options.ci, () => runBuildCommand(options));
    }
  );

program
  .command("release")
  .description("Build and upload to store in one flow (always builds first, then uploads)")
  .option("-e, --env <name>", "Environment name from config")
  .option("-t, --type <buildType>", "Build type: development | adhoc | store (default: store)")
  .option("-p, --platform <platform>", "Platform: android | ios")
  .option("-f, --flavor <name>", "Optional platform flavor")
  .option("--android-artifact <type>", "Android output artifact: apk | bundle")
  .option("--ios-artifact <type>", "iOS upload artifact type (default: ipa)")
  .option("--artifact-path <path>", "Explicit artifact path for upload step")
  .option("-l, --lane <name>", "Fastlane lane name (default from config or upload_store)")
  .option("--track <name>", "Store track/destination (android: internal/beta/... , ios: testflight/app_store)")
  .option("--cwd <path>", "Project path (defaults to current directory)")
  .option("--fast", "Apply platform fast-track flags for faster archives/builds")
  .option("--raw-logs", "Print raw logs instead of styled output")
  .option("--dry-run", "Preview build command and skip upload")
  .option("--ci", "Run in CI mode (non-interactive, skips confirmations)")
  .action(
    async (options: {
      env?: string;
      type?: string;
      platform?: string;
      flavor?: string;
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
    }) => {
      await withErrorHandler("release", options.ci, () => runReleaseCommand(options));
    }
  );

program
  .command("run")
  .description("Run the React Native app in debug mode with selected environment")
  .option("-e, --env <name>", "Environment name from config")
  .option("-p, --platform <platform>", "Platform: android | ios")
  .option("-f, --flavor <name>", "Optional platform flavor to run")
  .option("--cwd <path>", "Project path (defaults to current directory)")
  .option("--raw-logs", "Print raw run logs instead of styled output")
  .option("--no-packager", "Do not start Metro packager from React Native CLI")
  .option("--ci", "Run in CI mode with structured JSON output and no prompts")
  .action(
    async (options: {
      env?: string;
      platform?: string;
      flavor?: string;
      cwd?: string;
      rawLogs?: boolean;
      noPackager?: boolean;
      ci?: boolean;
    }) => {
      await withErrorHandler("run", options.ci, () => runAppCommand(options));
    }
  );

program
  .command("fastlane [action]")
  .description("Configure Fastlane files and upload defaults")
  .option("--cwd <path>", "Project path (defaults to current directory)")
  .option("--force", "Overwrite existing Fastlane files without confirmation")
  .option("--ci", "Run in CI mode with structured JSON output and no prompts")
  .action(async (action?: string, options?: { cwd?: string; force?: boolean; ci?: boolean }) => {
    await withErrorHandler("fastlane", options?.ci, async () => {
      const selectedAction = action ?? "setup";
      if (selectedAction !== "setup") {
        throw new Error("Invalid action. Supported: setup");
      }

      return runFastlaneSetupCommand({
        cwd: options?.cwd,
        force: Boolean(options?.force)
      });
    });
  });

program
  .command("doctor")
  .description("Check if current folder looks like a React Native CLI project")
  .option("--cwd <path>", "Project path (defaults to current directory)")
  .option("--ci", "Run in CI mode with structured JSON output and no prompts")
  .action(async (options: { cwd?: string; ci?: boolean }) => {
    await withErrorHandler("doctor", options.ci, () => runDoctorCommand(options.cwd));
  });

program
  .command("version")
  .description(
    "Update Android/iOS version values (versionName/CFBundleShortVersionString and versionCode/CFBundleVersion)"
  )
  .option("-p, --platform <platform>", "Platform: android | ios")
  .option("-f, --flavor <name>", "Flavor key from config (or iOS scheme mapping)")
  .option("--all-flavors", "Update all configured flavors/schemes for the selected platform")
  .option("-v, --version <version>", "Version string applied to both platforms")
  .option("--android-build-number <number>", "Android versionCode (integer)")
  .option("--ios-build-number <number>", "iOS CURRENT_PROJECT_VERSION (integer)")
  .option("--cwd <path>", "Project path (defaults to current directory)")
  .option("--ci", "Run in CI mode with structured JSON output and no prompts")
  .action(
    async (options: {
      platform?: string;
      flavor?: string;
      allFlavors?: boolean;
      version?: string;
      androidBuildNumber?: string;
      iosBuildNumber?: string;
      cwd?: string;
      ci?: boolean;
    }) => {
      await withErrorHandler("version", options.ci, () => runVersionCommand(options));
    }
  );

program
  .command("env [action] [env-name]")
  .description("Manage environments: list | view | add | edit | remove | set-default | detect")
  .option("--ci", "Run in CI mode with structured JSON output and no prompts")
  .action(async (action?: string, envName?: string, options?: { ci?: boolean }) => {
    await withErrorHandler("env", options?.ci, async () => {
      const validActions = ["list", "view", "add", "edit", "remove", "set-default", "detect"];
      if (action && !validActions.includes(action)) {
        throw new Error(`Invalid action '${action}'. Use: ${validActions.join(", ")}`);
      }
      return runEnvCommand(
        action as
          | "list"
          | "view"
          | "add"
          | "edit"
          | "remove"
          | "set-default"
          | "detect"
          | undefined,
        envName
      );
    });
  });

program
  .command("flavor [action] [platform] [name]")
  .description("Manage platform flavors: list | add | edit | remove | set-default | detect")
  .option("--ci", "Run in CI mode with structured JSON output and no prompts")
  .action(async (action?: string, platform?: string, name?: string, options?: { ci?: boolean }) => {
    await withErrorHandler("flavor", options?.ci, async () => {
      const validActions = ["list", "add", "edit", "remove", "set-default", "detect"];
      if (action && !validActions.includes(action)) {
        throw new Error(`Invalid action '${action}'. Use: ${validActions.join(", ")}`);
      }
      if (platform && !["android", "ios"].includes(platform)) {
        throw new Error("Platform must be one of: android, ios");
      }
      return runFlavorCommand(
        action as "list" | "add" | "edit" | "remove" | "set-default" | "detect" | undefined,
        platform,
        name
      );
    });
  });

void program.parseAsync(process.argv);
