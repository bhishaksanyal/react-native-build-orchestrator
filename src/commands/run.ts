import path from "node:path";
import { confirm, intro, isCancel, outro, select } from "@clack/prompts";
import pc from "picocolors";
import { execa } from "execa";

import { loadConfig } from "../utils/config.js";
import { interpolate, readDotEnv } from "../utils/env.js";
import { createRuntimeVars, writeRuntimeEnvExports } from "../utils/runtime-exports.js";
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

function toFlavorTaskName(flavor: string): string {
  return flavor
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
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

function summarizeIosCompilerError(line: string): string | null {
  const normalized = line.replace(/\\=/g, "=");

  const sourcePath = normalized.match(/(?:^|\s)-c\s+(\/[^\s]+\.(?:m|mm|c|cc|cpp|swift))/)?.[1];
  const sourceFile = sourcePath ? path.basename(sourcePath) : undefined;

  const explicitMessage = normalized.match(/\berror:\s*(.+)$/)?.[1]?.trim();
  if (explicitMessage) {
    return sourceFile ? `${explicitMessage} (${sourceFile})` : explicitMessage;
  }

  const flagMessage = normalized.match(/\berror\s+(-[A-Za-z0-9_-]+)/)?.[1];
  if (flagMessage) {
    return sourceFile ? `${flagMessage} (${sourceFile})` : flagMessage;
  }

  const keywordMessage = normalized.match(/\berror\s+([^\s]+(?:-[^\s]+)+)/)?.[1];
  if (keywordMessage) {
    return sourceFile ? `${keywordMessage} (${sourceFile})` : keywordMessage;
  }

  return null;
}

function styleIosLine(t: string): string {
  if (!t) return "";

  // ── React Native CLI status lines ────────────────────────────────────────
  if (/^- Building the app\.{0,}$/.test(t)) return "";
  if (/^info A dev server is already running/.test(t)) return pc.gray(`  ${t}`);
  if (/^info Found Xcode workspace /.test(t)) return pc.cyan(`  ⟳ ${t.replace(/^info\s+/, "")}`);
  if (/^info Found booted /.test(t)) return pc.cyan(`  ⟳ ${t.replace(/^info\s+/, "")}`);
  if (/^info Building \(using /.test(t)) return pc.bold(pc.cyan("  ▶ Starting Xcode build"));
  if (/^info Installing /.test(t)) return pc.bold(pc.cyan(`  ⬇ ${t.replace(/^info\s+/, "")}`));
  if (/^info Launching /.test(t)) return pc.bold(pc.green(`  ▶ ${t.replace(/^info\s+/, "")}`));
  if (/^info /.test(t)) return pc.gray(`  ${t}`);

  // ── Terminal outcomes ─────────────────────────────────────────────────────
  if (/\*\* BUILD SUCCEEDED \*\*/.test(t)) return pc.bold(pc.green("  ✓ Build succeeded"));
  if (/\*\* BUILD FAILED \*\*/.test(t))    return pc.bold(pc.red("  ✗ Build failed"));

  // ── Build target header ──────────────────────────────────────────────────
  const targetM = t.match(/^=== BUILD TARGET (.+?) OF .+ WITH CONFIGURATION (.+?) ===$/);
  if (targetM) return pc.bold(pc.cyan(`  ▶ ${targetM[1]}  [${targetM[2]}]`));

  // ── Compile ──────────────────────────────────────────────────────────────
  if (/^CompileSwift\b/.test(t)) {
    const file = t.split(" ").pop()?.split("/").pop() ?? "";
    return pc.cyan(`  ⟳ Swift  ${file}`);
  }
  if (/^CompileC\b/.test(t)) {
    const file = t.split(" ").pop()?.split("/").pop() ?? "";
    return pc.cyan(`  ⟳ C/ObjC ${file}`);
  }
  if (/^SwiftDriver\b|^SwiftCompile\b|^SwiftMergeGeneratedHeaders\b/.test(t)) return "";
  if (/^SwiftEmitModule\b/.test(t)) return pc.cyan("  ⟳ Emitting Swift module");

  // ── Link / Sign ──────────────────────────────────────────────────────────
  if (/^Ld\b/.test(t)) {
    const file = t.split(" ")[1]?.split("/").pop() ?? "";
    return pc.magenta(`  ⟳ Linking ${file}`);
  }
  if (/^CodeSign\b/.test(t)) {
    const file = t.match(/CodeSign\s+(\S+)/)?.[1]?.split("/").pop() ?? "";
    return pc.blue(`  ⟳ Code signing ${file}`);
  }

  // ── Script phases ────────────────────────────────────────────────────────
  const scriptM = t.match(/^PhaseScriptExecution\s+(\S+)/);
  if (scriptM) return pc.cyan(`  ⟳ Script: ${scriptM[1].replace(/_/g, " ")}`);

  // ── Bundle / Install / Launch ─────────────────────────────────────────────
  if (/^Touch\b/.test(t)) {
    const file = t.split(" ")[1]?.split("/").pop() ?? "";
    return pc.cyan(`  ⟳ Creating bundle: ${file}`);
  }
  if (/^Installing\b/.test(t)) {
    const app = t.split("/").pop() ?? "";
    return pc.bold(pc.cyan(`  ⬇ Installing ${app}`));
  }
  if (/^Launching\b/.test(t)) return pc.bold(pc.green("  ▶ Launching app"));

  // ── Metro / packager ─────────────────────────────────────────────────────
  if (/BUNDLE|Metro|Loading dependency graph/.test(t)) return pc.cyan(`  ⟳ ${t}`);

  // ── Known xcode noise emitted on stderr ──────────────────────────────────
  if (/^error export\s+/.test(t)) return "";
  if (/^error VALIDATE_PRODUCT=/.test(t)) return "";
  if (/^error [A-Z0-9_]+=/.test(t)) return "";
  if (/^error .*\/common-args\.resp\b/.test(t)) {
    const summary = summarizeIosCompilerError(t);
    return pc.red(`  ✗ ${summary ?? "Compiler invocation failed"}`);
  }

  // ── Source diagnostics: /path/file.swift:10:5: error: ... ────────────────
  if (/:\s*error:/.test(t))   return pc.red(`  ✗ ${t}`);
  if (/:\s*warning:/.test(t)) return pc.yellow(`  ⚠ ${t}`);
  if (/:\s*note:/.test(t))    return pc.gray(`  ℹ ${t}`);

  // ── Generic keywords ─────────────────────────────────────────────────────
  if (/^error\s+/.test(t)) {
    const summary = summarizeIosCompilerError(t);
    return summary ? pc.red(`  ✗ ${summary}`) : "";
  }
  if (/\b(error|FAILED)\b/i.test(t))           return pc.red(`  ✗ ${t}`);
  if (/\b(warning|deprecated)\b/i.test(t))     return pc.yellow(`  ⚠ ${t}`);

  // ── Noisy lines (raw paths, env exports, tool invocations) ───────────────
  if (/^[\/]|^export |^\s*(cd |builtin-|setenv)/.test(t)) return "";
  if (/^CpResource\b|^Copy\b|^ProcessInfoPlist\b|^Validate\b|^GenerateDSYM\b/.test(t)) return "";

  return pc.gray(`  ${t}`);
}

function styleAndroidLine(t: string): string {
  if (!t) return "";

  if (/BUILD SUCCESSFUL/i.test(t)) return pc.bold(pc.green(`  ✓ ${t}`));
  if (/BUILD FAILED/i.test(t))     return pc.bold(pc.red(`  ✗ ${t}`));

  if (/^> Task /.test(t))              return pc.cyan(`  ▶ ${t}`);
  if (/^\d+ actionable task/.test(t)) return pc.gray(`  ${t}`);

  if (/^Installing APK/i.test(t) || /^Installed on/i.test(t)) return pc.cyan(`  ⬇ ${t}`);
  if (/Starting: Intent/.test(t)) return pc.bold(pc.green("  ▶ Launching app"));

  if (/\berror\b/i.test(t))      return pc.red(`  ✗ ${t}`);
  if (/\bwarning\b/i.test(t))    return pc.yellow(`  ⚠ ${t}`);
  if (/\bdeprecated\b/i.test(t)) return pc.yellow(`  ⚠ ${t}`);

  return pc.gray(`  ${t}`);
}

function styleRunLine(line: string, platform: Platform | "unknown"): string {
  const t = line.trim();
  if (!t) return "";
  return platform === "ios"
    ? styleIosLine(t)
    : platform === "android"
      ? styleAndroidLine(t)
      : pc.gray(`  ${t}`);
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

async function runCommandWithLogs(params: {
  command: string;
  cwd: string;
  env: Record<string, string | undefined>;
  rawLogs: boolean;
  platform: Platform | "unknown";
}): Promise<void> {
  const child = execa(params.command, {
    cwd: params.cwd,
    shell: true,
    env: params.env,
    all: true,
    reject: false
  });

  let pending = "";
  const rawLines: string[] = [];
  if (child.all) {
    for await (const chunk of child.all) {
      const text = chunk.toString();
      pending += text;

      while (pending.includes("\n")) {
        const newlineIndex = pending.indexOf("\n");
        const line = pending.slice(0, newlineIndex).replace(/\r$/, "");
        pending = pending.slice(newlineIndex + 1);
        rawLines.push(line);

        if (params.rawLogs) {
          console.log(line);
        } else {
          const styled = styleRunLine(line, params.platform);
          if (styled) console.log(styled);
        }
      }
    }
  }

  if (pending.trim()) {
    rawLines.push(pending);
    if (params.rawLogs) {
      console.log(pending);
    } else {
      const styled = styleRunLine(pending, params.platform);
      if (styled) console.log(styled);
    }
  }

  const result = await child;
  if (result.exitCode !== 0) {
    throw new RunCommandError(
      "Run command failed.",
      analyzeRunFailure(rawLines, params.platform)
    );
  }
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
    await runCommandWithLogs({
      command: runCommand,
      cwd: projectDir,
      rawLogs: Boolean(options.rawLogs),
      platform: selectedPlatform as Platform,
      env: {
        ...process.env,
        ...mergedVars,
        ENVFILE: runtimeArtifacts.runtimeEnvFilePath
      }
    });
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