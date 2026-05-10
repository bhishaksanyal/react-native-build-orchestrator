/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

// Use unstable_mockModule for ESM consistency
jest.unstable_mockModule("../../utils/config.js", () => ({
  loadConfig: jest.fn()
}));
jest.unstable_mockModule("@clack/prompts", () => ({
  confirm: jest.fn(),
  intro: jest.fn(),
  isCancel: jest.fn(),
  outro: jest.fn(),
  select: jest.fn(),
  spinner: jest.fn()
}));
jest.unstable_mockModule("execa", () => ({
  execa: jest.fn()
}));
jest.unstable_mockModule("../../utils/runtime-exports.js", () => ({
  createRuntimeVars: jest.fn(),
  writeRuntimeEnvExports: jest.fn()
}));
jest.unstable_mockModule("../../utils/env.js", () => ({
  interpolate: jest.fn(),
  readDotEnv: jest.fn()
}));

const { runAppCommand } = await import("../../commands/run.js");
const { loadConfig } = await import("../../utils/config.js") as any;
const { confirm, isCancel, select } = await import("@clack/prompts") as any;
const { execa } = await import("execa") as any;
const { createRuntimeVars, writeRuntimeEnvExports } = await import("../../utils/runtime-exports.js") as any;
const { interpolate, readDotEnv } = await import("../../utils/env.js") as any;

describe("run command", () => {
  const MOCK_CONFIG = {
    projectName: "Test",
    defaultEnvironment: "dev",
    environments: {
        dev: { vars: {}, envFile: ".env" },
        prod: { vars: {} }
    },
    flavors: {
        android: { options: ["dev", "prod"], default: "dev", commandMap: { prod: "ProdFlavor" } },
        ios: { options: ["App"], default: "App" }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    loadConfig.mockResolvedValue(MOCK_CONFIG);
    select.mockImplementation((o: any) => {
        if (o.message.includes("environment")) return Promise.resolve("dev");
        if (o.message.includes("platform")) return Promise.resolve("android");
        return Promise.resolve("dev");
    });
    confirm.mockResolvedValue(true);
    isCancel.mockImplementation((v: any) => typeof v === "symbol");

    execa.mockReturnValue({
        all: (async function* () {
            yield "- Building the app\n";
            yield "info A dev server is already running\n";
            yield "info Found Xcode workspace \n";
            yield "info Found booted \n";
            yield "info Building (using \n";
            yield "info Installing \n";
            yield "info Launching \n";
            yield "info general\n";
            yield "** BUILD SUCCEEDED **\n";
            yield "** BUILD FAILED **\n";
            yield "=== BUILD TARGET App OF Project WITH CONFIGURATION Debug ===\n";
            yield "CompileSwift /path/File.swift\n";
            yield "CompileC /path/File.c\n";
            yield "SwiftDriver\n";
            yield "SwiftEmitModule\n";
            yield "Ld /path/App\n";
            yield "CodeSign /path/App.app\n";
            yield "PhaseScriptExecution Script\n";
            yield "Touch /path/App.app\n";
            yield "Installing /path/App.app\n";
            yield "Launching\n";
            yield "BUNDLE\n";
            yield "error export \n";
            yield "error VALIDATE_PRODUCT=\n";
            yield "error OTHER_FLAG=\n";
            yield "error /path/common-args.resp -flag\n";
            yield "/path/file.swift:10:5: error: boom\n";
            yield "/path/file.swift:10:5: warning: watch out\n";
            yield "/path/file.swift:10:5: note: btw\n";
            yield "error -mflag\n";
            yield "error some-keyword-error\n";
            yield "error: raw error\n";
            yield "FAILED\n";
            yield "warn\n";
            yield "/absolute/path\n";
            yield "CpResource\n";
            yield "BUILD SUCCESSFUL\n";
            yield "BUILD FAILED\n";
            yield "> Task :app:assemble\n";
            yield "1 actionable task\n";
            yield "Installing APK\n";
            yield "Installed on\n";
            yield "Starting: Intent\n";
            yield "some other line";
        })(),
        exitCode: 0
    } as any);

    createRuntimeVars.mockReturnValue({});
    writeRuntimeEnvExports.mockResolvedValue({
        runtimeEnvFilePath: "env",
        runtimeWrapperPath: "wrapper",
        iosInfoPlistPaths: ["plist"],
        androidJsonPath: "json",
        androidXmlPath: "xml"
    });
    readDotEnv.mockResolvedValue({});
    interpolate.mockImplementation((s: string) => s);
  });

  it("runs the app on android and covers styling", async () => {
    await runAppCommand({ platform: "android", env: "dev" });
    expect(execa).toHaveBeenCalled();
  });

  it("runs the app on ios and covers styling", async () => {
      select.mockResolvedValueOnce("dev").mockResolvedValueOnce("ios");
      await runAppCommand({});
      expect(execa).toHaveBeenCalled();
  });

  it("handles cancel in environment selection", async () => {
      select.mockResolvedValueOnce(Symbol("cancel"));
      await runAppCommand({});
      expect(execa).not.toHaveBeenCalled();
  });

  it("handles cancel in platform selection", async () => {
      select.mockResolvedValueOnce("dev").mockResolvedValueOnce(Symbol("cancel"));
      await runAppCommand({});
      expect(execa).not.toHaveBeenCalled();
  });

  it("handles cancel in flavor selection", async () => {
      select.mockResolvedValueOnce("dev").mockResolvedValueOnce("android").mockResolvedValueOnce(Symbol("cancel"));
      await runAppCommand({});
      expect(execa).not.toHaveBeenCalled();
  });

  it("handles cancel in shouldRun confirmation", async () => {
      confirm.mockResolvedValueOnce(Symbol("cancel"));
      await runAppCommand({ platform: "android", env: "dev" });
      expect(execa).not.toHaveBeenCalled();
  });

  it("handles buildRunCommand branches with flavor", async () => {
      await runAppCommand({ platform: "android", flavor: "prod", env: "dev" });
      expect(execa).toHaveBeenCalledWith(expect.stringContaining("ProdFlavorDebug"), expect.any(Object));
  });

  it("handles build failure and hints", async () => {
      execa.mockReturnValue({
          all: (async function* () {
              yield "error: non-modular-include-in-framework-module GeneratedDotEnv.m\n";
          })(),
          exitCode: 1
      } as any);
      const err: any = await runAppCommand({ platform: "ios", env: "dev" }).catch(e => e);
      expect(err.hints.length).toBeGreaterThan(0);
  });

  it("throws error for invalid platform", async () => {
      await expect(runAppCommand({ platform: "invalid" })).rejects.toThrow(/Invalid platform/);
  });

  it("throws error when flavor provided but not configured for platform", async () => {
      loadConfig.mockResolvedValue({ ...MOCK_CONFIG, flavors: {} });
      await expect(runAppCommand({ platform: "android", flavor: "dev" })).rejects.toThrow(/No flavors configured/);
  });

  it("throws error for invalid environment", async () => {
      await expect(runAppCommand({ env: "invalid" })).rejects.toThrow(/Environment 'invalid' is not configured/);
  });

  it("throws error for invalid flavor", async () => {
      await expect(runAppCommand({ platform: "android", flavor: "invalid" })).rejects.toThrow(/Flavor 'invalid' is not configured/);
  });

  it("throws error if defaultEnvironment is missing in config", async () => {
      loadConfig.mockResolvedValue({ ...MOCK_CONFIG, defaultEnvironment: undefined });
      await expect(runAppCommand({})).rejects.toThrow(/valid defaultEnvironment is required/);
  });

  it("handles raw logs", async () => {
      await runAppCommand({ platform: "android", env: "dev", rawLogs: true });
      expect(execa).toHaveBeenCalled();
  });

  it("covers specific regex branches in stylers", async () => {
       execa.mockReturnValue({
          all: (async function* () {
              yield "error: something happened\n";
              yield "SwiftMergeGeneratedHeaders\n";
              yield "SwiftCompile\n";
              yield "Validate\n";
              yield "GenerateDSYM\n";
              yield "Copy\n";
              yield "ProcessInfoPlist\n";
              yield "builtin-\n";
              yield "setenv\n";
              yield "cd /\n";
              yield "export VAR=1\n";
              yield "error export \n";
              yield "** BUILD SUCCEEDED **\n";
          })(),
          exitCode: 0
      } as any);
      await runAppCommand({ platform: "ios", env: "dev" });
  });
});
