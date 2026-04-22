#!/usr/bin/env node
import { program } from "commander";
import pc from "picocolors";

import { runInitCommand } from "./commands/init.js";
import { runBuildCommand } from "./commands/build.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runEnvCommand } from "./commands/env.js";
import { runFastlaneSetupCommand } from "./commands/fastlane.js";
import { runFlavorCommand } from "./commands/flavor.js";
import { runReleaseCommand } from "./commands/release.js";
import { runAppCommand } from "./commands/run.js";
import { runUploadCommand } from "./commands/upload.js";
import { runVersionCommand } from "./commands/version.js";

program
  .name("rnbuild")
  .description("Interactive React Native build and archive helper")
  .version("0.1.0");

program
  .command("init")
  .description("Create a .rnbuildrc.yml configuration file")
  .option("--force", "Overwrite existing config")
  .option("--project-name <name>", "Set project name/scheme default")
  .action(async (options: { force?: boolean; projectName?: string }) => {
    try {
      await runInitCommand({
        force: Boolean(options.force),
        projectName: options.projectName
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`init failed: ${message}`));
      process.exitCode = 1;
    }
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
    }) => {
      try {
        await runBuildCommand(options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(pc.red(`build failed: ${message}`));
        process.exitCode = 1;
      }
    }
  );

program
  .command("release")
  .description("Run build then upload in one flow")
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
  .option("--skip-build", "Skip build step and run upload only")
  .option("--fast", "Apply platform fast-track flags for faster archives/builds")
  .option("--raw-logs", "Print raw logs instead of styled output")
  .option("--dry-run", "Preview build command and skip upload")
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
      skipBuild?: boolean;
      fast?: boolean;
      rawLogs?: boolean;
      dryRun?: boolean;
    }) => {
      try {
        await runReleaseCommand(options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(pc.red(`release failed: ${message}`));
        process.exitCode = 1;
      }
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
  .action(
    async (options: {
      env?: string;
      platform?: string;
      flavor?: string;
      cwd?: string;
      rawLogs?: boolean;
      noPackager?: boolean;
    }) => {
      try {
        await runAppCommand(options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(pc.red(`run failed: ${message}`));
        process.exitCode = 1;
      }
    }
  );

program
  .command("upload")
  .description("Upload store build using Fastlane")
  .option("-e, --env <name>", "Environment name from config")
  .option("-p, --platform <platform>", "Platform: android | ios")
  .option("-f, --flavor <name>", "Optional platform flavor")
  .option("-l, --lane <name>", "Fastlane lane name (default: upload_store)")
  .option("--track <name>", "Store track/destination (android: internal/beta/... , ios: testflight/app_store)")
  .option("--artifact-type <type>", "Artifact type hint for lane: apk | aab | ipa")
  .option("--artifact-path <path>", "Explicit artifact path for lane upload")
  .option("--cwd <path>", "Project path (defaults to current directory)")
  .option("--raw-logs", "Print raw fastlane logs instead of styled output")
  .action(
    async (options: {
      env?: string;
      platform?: string;
      flavor?: string;
      lane?: string;
      track?: string;
      artifactType?: string;
      artifactPath?: string;
      cwd?: string;
      rawLogs?: boolean;
    }) => {
      try {
        await runUploadCommand(options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(pc.red(`upload failed: ${message}`));
        process.exitCode = 1;
      }
    }
  );

program
  .command("fastlane [action]")
  .description("Configure Fastlane files and upload defaults")
  .option("--cwd <path>", "Project path (defaults to current directory)")
  .option("--force", "Overwrite existing Fastlane files without confirmation")
  .action(async (action?: string, options?: { cwd?: string; force?: boolean }) => {
    try {
      const selectedAction = action ?? "setup";
      if (selectedAction !== "setup") {
        throw new Error("Invalid action. Supported: setup");
      }

      await runFastlaneSetupCommand({
        cwd: options?.cwd,
        force: Boolean(options?.force)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`fastlane failed: ${message}`));
      process.exitCode = 1;
    }
  });

program
  .command("doctor")
  .description("Check if current folder looks like a React Native CLI project")
  .option("--cwd <path>", "Project path (defaults to current directory)")
  .action(async (options: { cwd?: string }) => {
    try {
      await runDoctorCommand(options.cwd);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`doctor failed: ${message}`));
      process.exitCode = 1;
    }
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
  .action(
    async (options: {
      platform?: string;
      flavor?: string;
      allFlavors?: boolean;
      version?: string;
      androidBuildNumber?: string;
      iosBuildNumber?: string;
      cwd?: string;
    }) => {
      try {
        await runVersionCommand(options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(pc.red(`version failed: ${message}`));
        process.exitCode = 1;
      }
    }
  );

program
  .command("env [action] [env-name]")
  .description("Manage environments: list | view | add | edit | remove | set-default | detect")
  .action(async (action?: string, envName?: string) => {
    try {
      const validActions = ["list", "view", "add", "edit", "remove", "set-default", "detect"];
      if (action && !validActions.includes(action)) {
        throw new Error(`Invalid action '${action}'. Use: ${validActions.join(", ")}`);
      }
      await runEnvCommand(
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`env failed: ${message}`));
      process.exitCode = 1;
    }
  });

program
  .command("flavor [action] [platform] [name]")
  .description("Manage platform flavors: list | add | edit | remove | set-default | detect")
  .action(async (action?: string, platform?: string, name?: string) => {
    try {
      const validActions = ["list", "add", "edit", "remove", "set-default", "detect"];
      if (action && !validActions.includes(action)) {
        throw new Error(`Invalid action '${action}'. Use: ${validActions.join(", ")}`);
      }
      if (platform && !["android", "ios"].includes(platform)) {
        throw new Error("Platform must be one of: android, ios");
      }
      await runFlavorCommand(
        action as "list" | "add" | "edit" | "remove" | "set-default" | "detect" | undefined,
        platform,
        name
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`flavor failed: ${message}`));
      process.exitCode = 1;
    }
  });

void program.parseAsync(process.argv);
