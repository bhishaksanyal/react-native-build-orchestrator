/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("execa", () => ({
  execa: jest.fn()
}));
jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: jest.fn(),
    ensureDir: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn()
  }
}));
jest.unstable_mockModule("../../utils/config.js", () => ({
  loadConfig: jest.fn(),
  CONFIG_FILE: ".rnbuildrc.yml"
}));
jest.unstable_mockModule("@clack/prompts", () => ({
  confirm: jest.fn(),
  intro: jest.fn(),
  isCancel: jest.fn().mockImplementation((v: any) => v === "__CANCEL__"),
  outro: jest.fn(),
  select: jest.fn(),
  spinner: jest.fn(),
  text: jest.fn()
}));
jest.unstable_mockModule("../../utils/runtime-exports.js", () => ({
  createRuntimeVars: jest.fn(),
  writeRuntimeEnvExports: jest.fn()
}));
jest.unstable_mockModule("../../utils/env.js", () => ({
  interpolate: jest.fn(),
  readDotEnv: jest.fn()
}));

const { runBuildCommand } = await import("../../commands/build.js");
const { loadConfig } = await import("../../utils/config.js") as any;
const { confirm, isCancel, select, spinner } = await import("@clack/prompts") as any;
const { execa } = await import("execa") as any;
const { createRuntimeVars, writeRuntimeEnvExports } = await import("../../utils/runtime-exports.js") as any;
const { interpolate, readDotEnv } = await import("../../utils/env.js") as any;
const fs = (await import("fs-extra")).default as any;

describe("build command", () => {
  const MOCK_CONFIG = {
    projectName: "Test",
    defaultEnvironment: "prod",
    environments: {
        prod: { vars: { FOO: "bar" }, envFile: ".env" },
        dev: { vars: {} }
    },
    flavors: {
        android: {
            options: ["free", "paid"],
            default: "free",
            commandMap: { paid: "PaidFlavor" }
        },
        ios: {
            options: ["App", "AppBeta"],
            default: "App"
        }
    },
    builds: {
      store: {
        android: { enabled: true, command: "gradlew {{ANDROID_TASK}}", outputHint: "hint.apk", androidArtifact: "bundle" as const },
        ios: { enabled: true, command: "xcodebuild -scheme {{PROJECT_NAME}}", outputHint: "hint.app" }
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    loadConfig.mockResolvedValue(MOCK_CONFIG);
    select.mockResolvedValue("prod");
    confirm.mockResolvedValue(true);
    spinner.mockReturnValue({ start: jest.fn(), stop: jest.fn() });
    isCancel.mockImplementation((v: any) => v === "__CANCEL__");
    fs.pathExists.mockResolvedValue(true);
    fs.ensureDir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
    fs.stat.mockResolvedValue({ isDirectory: () => true });
    fs.readFile.mockResolvedValue("KEY=VAL");

    execa.mockReturnValue({
        all: (async function* () {
            yield "BUILD SUCCESSFUL\n";
            yield "CompileSwift File.swift\n";
            yield "Ld App\n";
            yield "** BUILD FAILED **\n";
        })(),
        exitCode: 0
    } as any);

    createRuntimeVars.mockReturnValue({ RUNTIME: "true" });
    writeRuntimeEnvExports.mockResolvedValue({
        runtimeTsPath: "ts",
        runtimeEnvFilePath: "env",
        runtimeWrapperPath: "wrapper",
        iosInfoPlistPaths: ["plist"],
        androidJsonPath: "json",
        androidXmlPath: "xml"
    });
    readDotEnv.mockResolvedValue({});
    interpolate.mockImplementation((s: string) => s);
  });

  it("executes build command", async () => {
    await runBuildCommand({ platform: "android", type: "store", env: "prod" });
    expect(execa).toHaveBeenCalled();
  });

  it("covers styler branches", async () => {
       execa.mockReturnValue({
          all: (async function* () {
              yield "error: some error\n";
              yield "warning: some warning\n";
              yield "deprecated\n";
              yield "CodeSign\n";
              yield "PhaseScriptExecution\n";
              yield "Touch\n";
              yield "Validate\n";
              yield "GenerateDSYM\n";
              yield "Copy\n";
              yield "ProcessInfoPlist\n";
              yield "builtin-\n";
              yield "setenv\n";
              yield "cd /\n";
              yield "export VAR=1\n";
              yield "Succeeded\n";
              yield "FAILED\n";
              yield "ARCHIVE SUCCEEDED\n";
              yield "** ARCHIVE FAILED **\n";
          })(),
          exitCode: 0
      } as any);
      await runBuildCommand({ platform: "ios", type: "store", env: "prod" });
      expect(execa).toHaveBeenCalledWith(expect.stringContaining("xcodebuild"), expect.any(Array), expect.any(Object));
  });

  describe("build command edge cases", () => {
    let originalPlatform: string;

    beforeAll(() => {
      originalPlatform = process.platform;
    });

    afterEach(() => {
      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        configurable: true
      });
    });

    it("throws if no environments configured", async () => {
      loadConfig.mockResolvedValueOnce({
        ...MOCK_CONFIG,
        environments: {}
      });
      await expect(runBuildCommand({ platform: "android", type: "store", env: "prod" })).rejects.toThrow("No environments configured");
    });

    it("throws if defaultEnvironment is missing", async () => {
      loadConfig.mockResolvedValueOnce({
        ...MOCK_CONFIG,
        defaultEnvironment: ""
      });
      await expect(runBuildCommand({ platform: "android", type: "store", env: "prod" })).rejects.toThrow("defaultEnvironment is missing");
    });

    it("throws if defaultEnvironment is not configured", async () => {
      loadConfig.mockResolvedValueOnce({
        ...MOCK_CONFIG,
        defaultEnvironment: "invalid"
      });
      await expect(runBuildCommand({ platform: "android", type: "store", env: "prod" })).rejects.toThrow("is not configured in environments");
    });

    it("throws on invalid android artifact", async () => {
      await expect(runBuildCommand({ platform: "android", type: "store", env: "prod", androidArtifact: "invalid" })).rejects.toThrow("Invalid Android artifact");
    });

    it("throws on invalid build type", async () => {
      await expect(runBuildCommand({ platform: "android", type: "invalid", env: "prod" })).rejects.toThrow("Invalid build type");
    });

    it("throws on invalid platform", async () => {
      await expect(runBuildCommand({ platform: "invalid", type: "store", env: "prod" })).rejects.toThrow("Invalid platform");
    });

    it("throws if flavor passed but no flavors configured", async () => {
      const configNoFlavors = { ...MOCK_CONFIG };
      delete (configNoFlavors as any).flavors;
      loadConfig.mockResolvedValueOnce(configNoFlavors);
      await expect(runBuildCommand({ platform: "android", type: "store", env: "prod", flavor: "free" })).rejects.toThrow("No flavors configured");
    });

    it("throws if flavor is not configured", async () => {
      await expect(runBuildCommand({ platform: "android", type: "store", env: "prod", flavor: "invalid" })).rejects.toThrow("is not configured");
    });

    it("throws if build target is not enabled", async () => {
      const configDisabled = JSON.parse(JSON.stringify(MOCK_CONFIG));
      configDisabled.builds.store.android.enabled = false;
      loadConfig.mockResolvedValueOnce(configDisabled);
      await expect(runBuildCommand({ platform: "android", type: "store", env: "prod" })).rejects.toThrow("Build target not enabled");
    });

    it("handles dryRun", async () => {
      const res = await runBuildCommand({ platform: "android", type: "store", env: "prod", dryRun: true });
      expect(res.dryRun).toBe(true);
    });

    it("handles non-CI user skip", async () => {
      confirm.mockResolvedValueOnce(false);
      const res = await runBuildCommand({ platform: "android", type: "store", env: "prod", ci: false });
      expect(res.status).toBe("cancelled");
    });

    it("handles build failure and throws", async () => {
      execa.mockReturnValueOnce({
        all: (async function* () { yield "error: fail\n"; })(),
        exitCode: 1
      } as any);
      await expect(runBuildCommand({ platform: "android", type: "store", env: "prod", ci: true })).rejects.toThrow("Build command failed");
    });

    it("covers resolveOutputFolder when parent exists but child does not", async () => {
      fs.pathExists.mockImplementation(async (p: string) => {
        if (p.endsWith("parent_dir") || p.includes("logs")) return true;
        return false;
      });
      fs.stat.mockResolvedValueOnce({ isDirectory: () => false } as any);
      const res = await runBuildCommand({ platform: "android", type: "store", env: "prod", ci: true });
      expect(res.status).toBe("success");
    });

    it("covers resolveOutputFolder when path is file", async () => {
      const configWithPath = JSON.parse(JSON.stringify(MOCK_CONFIG));
      configWithPath.builds.store.android.outputHint = "./hint.apk";
      loadConfig.mockResolvedValue(configWithPath);

      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => false } as any);

      const res = await runBuildCommand({ platform: "android", type: "store", env: "prod", ci: true });
      expect(res.status).toBe("success");
    });

    it("covers openFolder for different platforms", async () => {
      const configWithPath = JSON.parse(JSON.stringify(MOCK_CONFIG));
      configWithPath.builds.store.android.outputHint = "./hint.apk";
      loadConfig.mockResolvedValue(configWithPath);

      fs.pathExists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({ isDirectory: () => true } as any);

      // darwin
      Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
      await runBuildCommand({ platform: "android", type: "store", env: "prod", ci: true });
      expect(execa).toHaveBeenCalledWith("open", expect.any(Array));

      // win32
      Object.defineProperty(process, "platform", { value: "win32", configurable: true });
      await runBuildCommand({ platform: "android", type: "store", env: "prod", ci: true });
      expect(execa).toHaveBeenCalledWith("explorer", expect.any(Array));

      // linux
      Object.defineProperty(process, "platform", { value: "linux", configurable: true });
      await runBuildCommand({ platform: "android", type: "store", env: "prod", ci: true });
      expect(execa).toHaveBeenCalledWith("xdg-open", expect.any(Array));
    });

    it("covers fast mode flags", async () => {
      // Android parallel build flags
      const configAndroidGradle = JSON.parse(JSON.stringify(MOCK_CONFIG));
      configAndroidGradle.builds.store.android.command = "./gradlew assembleDebug";
      loadConfig.mockResolvedValueOnce(configAndroidGradle);
      let res = await runBuildCommand({ platform: "android", type: "store", env: "prod", ci: true, fast: true });
      expect(res.status).toBe("success");

      // iOS xcodebuild flags
      const configIosXcode = JSON.parse(JSON.stringify(MOCK_CONFIG));
      configIosXcode.builds.store.ios.command = "xcodebuild build";
      loadConfig.mockResolvedValueOnce(configIosXcode);
      res = await runBuildCommand({ platform: "ios", type: "store", env: "prod", ci: true, fast: true });
      expect(res.status).toBe("success");
    });

    it("covers template bypass in commands", async () => {
      const configBypass = JSON.parse(JSON.stringify(MOCK_CONFIG));
      configBypass.builds.store.android.command = "gradlew assembleDebug {{ANDROID_ARTIFACT}} {{FLAVOR}}";
      configBypass.builds.store.ios.command = "xcodebuild -scheme {{FLAVOR}}";
      loadConfig.mockResolvedValueOnce(configBypass);
      const res = await runBuildCommand({ platform: "android", type: "store", env: "prod", ci: true, flavor: "free" });
      expect(res.status).toBe("success");
    });

    it("covers rawLogs enabled", async () => {
      const res = await runBuildCommand({ platform: "android", type: "store", env: "prod", ci: true, rawLogs: true });
      expect(res.status).toBe("success");
    });

    it("throws on invalid Android artifact in helper", async () => {
        const { asAndroidArtifact } = await import("../../utils/command-helpers.js") as any;
        expect(() => asAndroidArtifact("invalid")).toThrow("Invalid Android artifact");
    });

    it("resolves flavor values correctly", async () => {
        const { resolveFlavorValue } = await import("../../utils/command-helpers.js") as any;
        expect(resolveFlavorValue(undefined, undefined)).toBe("");
        expect(resolveFlavorValue({ dev: "DevFlavor" }, "dev")).toBe("DevFlavor");
        expect(resolveFlavorValue({ dev: "DevFlavor" }, "prod")).toBe("prod");
    });

    it("covers applyAndroidArtifactToCommand when task is NOT present in template", async () => {
        const { applyAndroidArtifactToCommand } = await import("../../commands/build.js") as any;
        expect(applyAndroidArtifactToCommand("gradlew assembleDebug", "development", "bundle")).toBe("gradlew bundleDebug");
        expect(applyAndroidArtifactToCommand("gradlew assembleRelease", "store", "bundle")).toBe("gradlew bundleRelease");
    });

    it("covers applyIosFlavorToCommand when flavor is NOT present in template", async () => {
        const { applyIosFlavorToCommand } = await import("../../commands/build.js") as any;
        expect(applyIosFlavorToCommand("xcodebuild", "MyScheme")).toBe("xcodebuild -scheme MyScheme");
        expect(applyIosFlavorToCommand("xcodebuild -scheme Old", "New")).toBe("xcodebuild -scheme New");
    });

    it("covers resolveAndroidOutputHint replacements", async () => {
        const { resolveAndroidOutputHint } = await import("../../utils/command-helpers.js") as any;
        expect(resolveAndroidOutputHint("/outputs/bundle/app.aab", "store", "apk")).toBe("/outputs/apk/app.apk");
    });

    it("handles openFolder failure", async () => {
        const configWithHint = JSON.parse(JSON.stringify(MOCK_CONFIG));
        configWithHint.builds.store.android.outputHint = "dist";
        loadConfig.mockResolvedValue(configWithHint);
        fs.pathExists.mockResolvedValue(true);
        fs.stat.mockResolvedValue({ isDirectory: () => true });

        // Force execa failure for open
        execa.mockImplementation((cmd: string) => {
            if (cmd === "open" || cmd === "explorer" || cmd === "xdg-open") {
                return Promise.reject(new Error("open failed"));
            }
            return {
                all: (async function* () { yield "ok"; })(),
                exitCode: 0
            };
        });

        Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
        await runBuildCommand({ platform: "android", type: "store", env: "prod", ci: true });
    });

    it("stylePrettyLine covers remaining branches", async () => {
        const { stylePrettyLine } = await import("../../commands/build.js") as any;
        expect(stylePrettyLine("")).toBe("");
        expect(stylePrettyLine("BUILD SUCCESSFUL")).toContain("BUILD SUCCESSFUL");
        expect(stylePrettyLine("> Task :app:assemble")).toContain("> Task");
        expect(stylePrettyLine("warning: something")).toContain("warning:");
        expect(stylePrettyLine("Compile some/file.swift")).toContain("Compile");
        expect(stylePrettyLine("Ld /path/to/binary")).toContain("Ld");
        expect(stylePrettyLine("CodeSign some.app")).toContain("CodeSign");
        expect(stylePrettyLine("PhaseScriptExecution script")).toContain("PhaseScriptExecution");
        expect(stylePrettyLine("plain output")).toContain("plain output");
    });

    it("covers applyIosFlavorToCommand when template vars ARE present", async () => {
        const { applyIosFlavorToCommand } = await import("../../commands/build.js") as any;
        expect(applyIosFlavorToCommand("xcodebuild {{FLAVOR_NAME}}", "MyScheme")).toBe("xcodebuild {{FLAVOR_NAME}}");
        expect(applyIosFlavorToCommand("xcodebuild {{FLAVOR}}", "MyScheme")).toBe("xcodebuild {{FLAVOR}}");
        expect(applyIosFlavorToCommand("xcodebuild {{FLAVOR_VALUE}}", "MyScheme")).toBe("xcodebuild {{FLAVOR_VALUE}}");
        expect(applyIosFlavorToCommand("xcodebuild {{FLAVOR_TASK}}", "MyScheme")).toBe("xcodebuild {{FLAVOR_TASK}}");
    });

    it("covers resolveOutputFolder when path does not exist", async () => {
        fs.pathExists.mockReset();
        fs.pathExists.mockImplementation(async (p: string) => {
            if (p.includes("logs")) return true;
            return false;
        });
        const res = await runBuildCommand({ platform: "android", type: "store", env: "prod", ci: true });
        expect(res.status).toBe("success");
    });

    it("covers augmentCommandForFastTrack non-matching platform", async () => {
        loadConfig.mockResolvedValueOnce({ ...JSON.parse(JSON.stringify(MOCK_CONFIG)), builds: { store: { android: { enabled: true, command: "react-native bundle" }, ios: { enabled: true, command: "react-native bundle" } } } });
        const res = await runBuildCommand({ platform: "android", type: "store", env: "prod", ci: true, fast: true });
        expect(res.status).toBe("success");
    });

    it("covers interactive select for env, type, and platform", async () => {
        select.mockReset();
        select.mockResolvedValueOnce("prod");
        select.mockResolvedValueOnce("store");
        select.mockResolvedValueOnce("android");
        const res = await runBuildCommand({ ci: true });
        expect(res.status).toBe("success");
    });

    it("throws when environment is not in config", async () => {
        await expect(runBuildCommand({ env: "nonexistent", platform: "android", type: "store", ci: true })).rejects.toThrow("is not configured");
    });

    it("throws when build profile not found", async () => {
        const configNoAdhoc = JSON.parse(JSON.stringify(MOCK_CONFIG));
        delete configNoAdhoc.builds.adhoc;
        loadConfig.mockResolvedValueOnce(configNoAdhoc);
        await expect(runBuildCommand({ type: "adhoc", platform: "android", env: "prod", ci: true })).rejects.toThrow("Build profile not found");
    });

    it("covers android artifact else branch (no artifact specified, prompt for it)", async () => {
        const configNoArtifact = JSON.parse(JSON.stringify(MOCK_CONFIG));
        delete configNoArtifact.builds.store.android.androidArtifact;
        loadConfig.mockResolvedValueOnce(configNoArtifact);
        select.mockResolvedValueOnce("bundle");
        const res = await runBuildCommand({ platform: "android", type: "store", env: "prod", ci: true });
        expect(res.status).toBe("success");
    });

  });
});
