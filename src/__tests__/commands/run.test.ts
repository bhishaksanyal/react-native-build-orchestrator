/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("execa", () => ({
  execa: jest.fn<any>()
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  intro: jest.fn(),
  outro: jest.fn(),
  log: jest.fn(),
  promptConfirm: jest.fn(),
  promptSelect: jest.fn(),
  isCancel: jest.fn().mockImplementation((v: any) => v === "__CANCEL__")
}));

jest.unstable_mockModule("../../utils/config.js", () => ({
  loadConfig: jest.fn<any>()
}));

jest.unstable_mockModule("../../utils/runtime-exports.js", () => ({
  createRuntimeVars: jest.fn<any>().mockReturnValue({}),
  writeRuntimeEnvExports: jest.fn<any>().mockResolvedValue({
      runtimeEnvFilePath: "env",
      runtimeWrapperPath: "wrapper",
      iosInfoPlistPaths: []
  })
}));

jest.unstable_mockModule("../../utils/env.js", () => ({
  interpolate: jest.fn<any>().mockImplementation((s: string) => s),
  readDotEnv: jest.fn<any>().mockResolvedValue({})
}));

const { runAppCommand } = await import("../../commands/run.js");
const { loadConfig } = await import("../../utils/config.js") as any;
const { promptSelect, promptConfirm, isCancel } = await import("../../utils/logger.js") as any;
const { interpolate, readDotEnv } = await import("../../utils/env.js") as any;
const { createRuntimeVars, writeRuntimeEnvExports } = await import("../../utils/runtime-exports.js") as any;
const { execa } = await import("execa") as any;

describe("run command", () => {
  const mockConfig = {
    projectName: "MyApp",
    defaultEnvironment: "dev",
    environments: {
      dev: { envFile: ".env.dev" }
    }
  };

  beforeEach(() => {
    jest.resetAllMocks();
    loadConfig.mockResolvedValue(mockConfig);
    promptSelect.mockImplementation((options: any) => Promise.resolve(options.initialValue || options.options[0].value));
    promptConfirm.mockResolvedValue(true);
    isCancel.mockImplementation((v: any) => v === "__CANCEL__");

    interpolate.mockImplementation((s: string) => s);
    readDotEnv.mockResolvedValue({});
    createRuntimeVars.mockReturnValue({});
    writeRuntimeEnvExports.mockResolvedValue({
      runtimeEnvFilePath: "env",
      runtimeWrapperPath: "wrapper",
      iosInfoPlistPaths: []
    });

    execa.mockReturnValue({
        all: (async function* () { yield Buffer.from("log line\n"); })(),
        exitCode: 0
    });
  });

  it("runs android app", async () => {
    const result = await runAppCommand({
      env: "dev",
      platform: "android",
      ci: true
    });
    expect(result.status).toBe("success");
    expect(execa).toHaveBeenCalledWith(expect.stringContaining("run-android"), expect.any(Object));
  });

  it("runs ios app", async () => {
    const result = await runAppCommand({
      env: "dev",
      platform: "ios",
      ci: true
    });
    expect(result.status).toBe("success");
    expect(execa).toHaveBeenCalledWith(expect.stringContaining("run-ios"), expect.any(Object));
  });

  it("handles flavor", async () => {
      loadConfig.mockResolvedValue({
          ...mockConfig,
          flavors: {
              android: { options: ["free", "paid"], default: "free" }
          }
      });
      const result = await runAppCommand({
          env: "dev",
          platform: "android",
          flavor: "paid",
          ci: true
      });
      expect(result.status).toBe("success");
      expect(execa).toHaveBeenCalledWith(expect.stringContaining("--mode PaidDebug"), expect.any(Object));
  });

  it("throws error if default environment is missing", async () => {
    loadConfig.mockResolvedValue({ ...mockConfig, defaultEnvironment: "" });
    await expect(runAppCommand({})).rejects.toThrow("valid defaultEnvironment is required");
  });

  it("handles failure with hints", async () => {
      execa.mockReturnValue({
          all: (async function* () {
              yield Buffer.from("non-modular-include-in-framework-module\n");
              yield Buffer.from("GeneratedDotEnv.m\n");
          })(),
          exitCode: 1
      });
      await expect(runAppCommand({
          env: "dev",
          platform: "ios",
          ci: true
      })).rejects.toThrow("Run command failed");
  });

  describe("run command edge cases", () => {
    it("throws error for invalid platform argument", async () => {
      await expect(runAppCommand({
        env: "dev",
        platform: "symbian",
        ci: true
      })).rejects.toThrow("Invalid platform 'symbian'");
    });

    it("throws error if flavor passed but no flavors configured", async () => {
      await expect(runAppCommand({
        env: "dev",
        platform: "android",
        flavor: "free",
        ci: true
      })).rejects.toThrow("No flavors configured for android");
    });

    it("throws error if flavor passed is not in options", async () => {
      loadConfig.mockResolvedValue({
        ...mockConfig,
        flavors: {
          android: { options: ["free", "paid"], default: "free" }
        }
      });
      await expect(runAppCommand({
        env: "dev",
        platform: "android",
        flavor: "pro",
        ci: true
      })).rejects.toThrow("Flavor 'pro' is not configured for android");
    });

    it("throws error if selected environment is not configured", async () => {
      await expect(runAppCommand({
        env: "staging",
        platform: "android",
        ci: true
      })).rejects.toThrow("Environment 'staging' is not configured");
    });

    it("handles cancel/decline confirm in non-CI mode", async () => {
      promptConfirm.mockResolvedValueOnce(false);
      const result = await runAppCommand({
        env: "dev",
        platform: "android",
        ci: false
      });
      expect(result.status).toBe("cancelled");
      expect(result.message).toBe("Run skipped by user");
    });

    it("supports noPackager and rawLogs options", async () => {
      const result = await runAppCommand({
        env: "dev",
        platform: "android",
        noPackager: true,
        rawLogs: true,
        ci: true
      });
      expect(result.status).toBe("success");
      expect(execa).toHaveBeenCalledWith(expect.stringContaining("--no-packager"), expect.any(Object));
    });

    it("covers styleAndroidLine stdout styling branches", async () => {
      execa.mockReturnValue({
        all: (async function* () {
          yield Buffer.from("BUILD SUCCESSFUL\n");
          yield Buffer.from("BUILD FAILED\n");
          yield Buffer.from("> Task :app:compile\n");
          yield Buffer.from("12 actionable tasks\n");
          yield Buffer.from("Installing APK...\n");
          yield Buffer.from("Starting: Intent...\n");
          yield Buffer.from("warning message\n");
          yield Buffer.from("deprecated message\n");
          yield Buffer.from("error message\n");
          yield Buffer.from("\n");
        })(),
        exitCode: 0
      });

      const result = await runAppCommand({
        env: "dev",
        platform: "android",
        ci: true
      });
      expect(result.status).toBe("success");
    });

    it("covers styleIosLine stdout styling branches", async () => {
      execa.mockReturnValue({
        all: (async function* () {
          yield Buffer.from("- Building the app.\n");
          yield Buffer.from("info A dev server is already running\n");
          yield Buffer.from("info Found Xcode workspace \n");
          yield Buffer.from("info Found booted \n");
          yield Buffer.from("info Building (using \n");
          yield Buffer.from("info Installing \n");
          yield Buffer.from("info Launching \n");
          yield Buffer.from("info general\n");
          yield Buffer.from("** BUILD SUCCEEDED **\n");
          yield Buffer.from("** BUILD FAILED **\n");
          yield Buffer.from("=== BUILD TARGET my_app OF my_project WITH CONFIGURATION Debug ===\n");
          yield Buffer.from("CompileSwift file.swift\n");
          yield Buffer.from("CompileC file.c\n");
          yield Buffer.from("SwiftDriver something\n");
          yield Buffer.from("SwiftEmitModule something\n");
          yield Buffer.from("Ld build/my_app\n");
          yield Buffer.from("CodeSign my_app.app\n");
          yield Buffer.from("PhaseScriptExecution compile_assets\n");
          yield Buffer.from("Touch build/my_app\n");
          yield Buffer.from("Installing app\n");
          yield Buffer.from("Launching app\n");
          yield Buffer.from("Metro bundle\n");
          yield Buffer.from("error export \n");
          yield Buffer.from("error VALIDATE_PRODUCT=\n");
          yield Buffer.from("error export KEY=\n");
          yield Buffer.from("error ./common-args.resp\n");
          yield Buffer.from("source.swift:10:5: error: syntax error\n");
          yield Buffer.from("source.swift:12:5: warning: check warning\n");
          yield Buffer.from("source.swift:14:5: note: check note\n");
          yield Buffer.from("error custom_msg\n");
          yield Buffer.from("FAILED\n");
          yield Buffer.from("warning\n");
          yield Buffer.from("/absolute/path\n");
          yield Buffer.from("CpResource resource\n");
          yield Buffer.from("random line\n");
        })(),
        exitCode: 0
      });

      const result = await runAppCommand({
        env: "dev",
        platform: "ios",
        ci: true
      });
      expect(result.status).toBe("success");
      expect(execa).toHaveBeenCalledWith(expect.stringContaining("run-ios"), expect.any(Object));
    });

    it("covers iOS compiler error summarizer branches", async () => {
        const { summarizeIosCompilerError } = await import("../../commands/run.js") as any;
        expect(summarizeIosCompilerError(" -c /path/file.swift error: message")).toBe("message (file.swift)");
        expect(summarizeIosCompilerError(" error: message")).toBe("message");
        expect(summarizeIosCompilerError(" -c /path/file.swift error -flag")).toBe("-flag (file.swift)");
        expect(summarizeIosCompilerError(" error -flag")).toBe("-flag");
        expect(summarizeIosCompilerError(" -c /path/file.swift error multi-word-error")).toBe("multi-word-error (file.swift)");
        expect(summarizeIosCompilerError(" error multi-word-error")).toBe("multi-word-error");
    });

    it("handles multiple updated Info.plist and native files in run output", async () => {
        writeRuntimeEnvExports.mockResolvedValueOnce({
            runtimeEnvFilePath: "env",
            runtimeWrapperPath: "wrapper",
            androidJsonPath: "json",
            androidXmlPath: "xml",
            iosInfoPlistPaths: ["plist1", "plist2"]
        });
        const result = await runAppCommand({
            env: "dev",
            platform: "android",
            ci: true
        });
        expect(result.status).toBe("success");
    });

    it("covers interactive select for env and platform", async () => {
        promptSelect.mockReset();
        promptSelect.mockResolvedValueOnce("dev");
        promptSelect.mockResolvedValueOnce("android");
        const result = await runAppCommand({ ci: true });
        expect(result.status).toBe("success");
    });

    it("covers interactive flavor select", async () => {
        loadConfig.mockResolvedValue({
            ...mockConfig,
            flavors: { android: { options: ["free", "paid"], default: "free" } }
        });
        promptSelect.mockReset();
        promptSelect.mockResolvedValueOnce("dev");
        promptSelect.mockResolvedValueOnce("android");
        promptSelect.mockResolvedValueOnce("paid");
        const result = await runAppCommand({ ci: true });
        expect(result.status).toBe("success");
    });

  });
});
