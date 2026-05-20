/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: jest.fn<any>(),
    ensureDir: jest.fn<any>(),
    writeFile: jest.fn<any>()
  }
}));

jest.unstable_mockModule("execa", () => ({
  execa: jest.fn<any>()
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  intro: jest.fn(),
  outro: jest.fn(),
  log: jest.fn(),
  spinner: jest.fn().mockReturnValue({ start: jest.fn(), stop: jest.fn() }),
  promptConfirm: jest.fn(),
  promptSelect: jest.fn(),
  promptText: jest.fn(),
  isCancel: jest.fn().mockImplementation((v: any) => v === "__CANCEL__")
}));

jest.unstable_mockModule("../../utils/config.js", () => ({
  loadConfig: jest.fn<any>()
}));

jest.unstable_mockModule("../../utils/runtime-exports.js", () => ({
  createRuntimeVars: jest.fn<any>().mockReturnValue({}),
  writeRuntimeEnvExports: jest.fn<any>().mockResolvedValue({
      runtimeEnvFilePath: "env",
      iosInfoPlistPaths: []
  })
}));

jest.unstable_mockModule("../../utils/env.js", () => ({
  interpolate: jest.fn<any>().mockImplementation((s: string) => s),
  readDotEnv: jest.fn<any>().mockResolvedValue({})
}));

jest.unstable_mockModule("../../commands/build.js", () => ({
  runBuildCommand: jest.fn<any>().mockResolvedValue({ status: "success" })
}));

const { runReleaseCommand } = await import("../../commands/release.js");
const { loadConfig } = await import("../../utils/config.js") as any;
const { promptSelect, promptConfirm, promptText, spinner, isCancel } = await import("../../utils/logger.js") as any;
const { interpolate, readDotEnv } = await import("../../utils/env.js") as any;
const { createRuntimeVars, writeRuntimeEnvExports } = await import("../../utils/runtime-exports.js") as any;
const { execa } = await import("execa") as any;
const fs = (await import("fs-extra")).default as any;

describe("release command", () => {
  const mockConfig = {
    projectName: "MyApp",
    defaultEnvironment: "prod",
    environments: {
      prod: { envFile: ".env.prod" }
    },
    builds: {
      store: {
        android: { enabled: true, command: "build", outputHint: "hint.aab" },
        ios: { enabled: true, command: "build", outputHint: "hint.ipa" }
      }
    }
  };

  beforeEach(() => {
    jest.resetAllMocks();
    loadConfig.mockResolvedValue(mockConfig);
    promptSelect.mockImplementation((options: any) => Promise.resolve(options.initialValue || options.options[0].value));
    promptConfirm.mockResolvedValue(true);
    promptText.mockImplementation((options: any) => Promise.resolve(options.defaultValue || ""));
    isCancel.mockImplementation((v: any) => v === "__CANCEL__");
    spinner.mockReturnValue({ start: jest.fn(), stop: jest.fn() });

    interpolate.mockImplementation((s: string) => s);
    readDotEnv.mockResolvedValue({});
    createRuntimeVars.mockReturnValue({});
    writeRuntimeEnvExports.mockResolvedValue({
      runtimeEnvFilePath: "env",
      iosInfoPlistPaths: []
    });

    fs.pathExists.mockResolvedValue(true);
    fs.ensureDir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);

    execa.mockReturnValue({
        all: (async function* () { yield Buffer.from("log line\n"); })(),
        then: (cb: any) => Promise.resolve({ exitCode: 0 }).then(cb)
    });
  });

  it("runs a full release for android", async () => {
    const result = await runReleaseCommand({
      env: "prod",
      platform: "android",
      type: "store",
      ci: true
    });
    expect(result.status).toBe("success");
    expect(execa).toHaveBeenCalled();
  });

  it("runs a full release for ios", async () => {
    const result = await runReleaseCommand({
      env: "prod",
      platform: "ios",
      type: "store",
      ci: true
    });
    expect(result.status).toBe("success");
    expect(execa).toHaveBeenCalled();
  });

  it("handles dry run", async () => {
    const result = await runReleaseCommand({
      env: "prod",
      platform: "android",
      type: "store",
      dryRun: true
    });
    expect(result.status).toBe("success");
    expect(result.dryRun).toBe(true);
    expect(execa).not.toHaveBeenCalledWith(expect.stringContaining("fastlane"), expect.any(Object));
  });

  it("throws error if default environment is missing", async () => {
    loadConfig.mockResolvedValue({ ...mockConfig, defaultEnvironment: "" });
    await expect(runReleaseCommand({})).rejects.toThrow("valid defaultEnvironment is required");
  });

  it("throws error if build target is disabled", async () => {
    loadConfig.mockResolvedValue({
        ...mockConfig,
        builds: { store: { android: { enabled: false } } }
    });
    await expect(runReleaseCommand({ platform: "android", type: "store" })).rejects.toThrow("Build target not enabled");
  });

  it("handles cancel in track selection", async () => {
    promptSelect.mockResolvedValueOnce("prod") // env
                .mockResolvedValueOnce("android") // platform
                .mockResolvedValueOnce("store") // type
                .mockResolvedValueOnce("bundle") // artifact
                .mockImplementationOnce(() => { throw new Error("Operation cancelled"); });

    await expect(runReleaseCommand({})).rejects.toThrow("Operation cancelled");
  });

  it("handles fastlane failure", async () => {
      execa.mockReturnValue({
          all: (async function* () { yield Buffer.from("error\n"); })(),
          then: (cb: any) => Promise.resolve({ exitCode: 1 }).then(cb)
      });
      await expect(runReleaseCommand({
          env: "prod",
          platform: "android",
          type: "store",
          ci: true,
          artifactPath: "path/to/artifact"
      })).rejects.toThrow("Fastlane upload failed");
  });

  describe("release command edge cases", () => {
    it("handles fastlane runner check failing and falling back to fastlane", async () => {
      execa.mockImplementationOnce(() => {
        throw new Error("no bundler");
      });
      const result = await runReleaseCommand({
        env: "prod",
        platform: "android",
        type: "store",
        ci: true
      });
      expect(result.status).toBe("success");
    });

    it("throws error if flavor passed but no flavors configured", async () => {
      const configNoFlavors = { ...mockConfig };
      delete (configNoFlavors as any).flavors;
      loadConfig.mockResolvedValueOnce(configNoFlavors);

      await expect(runReleaseCommand({
        env: "prod",
        platform: "android",
        type: "store",
        flavor: "free"
      })).rejects.toThrow("No flavors configured for android");
    });

    it("throws error if flavor is not in configured options", async () => {
      const configWithFlavors = {
        ...mockConfig,
        flavors: {
          android: { options: ["free", "paid"], default: "free" }
        }
      };
      loadConfig.mockResolvedValueOnce(configWithFlavors);

      await expect(runReleaseCommand({
        env: "prod",
        platform: "android",
        type: "store",
        flavor: "invalid"
      })).rejects.toThrow("Flavor 'invalid' is not configured for android");
    });

    it("handles track selection cancellation", async () => {
      promptSelect.mockImplementation((options: any) => {
        if (options.message.includes("Choose Android track") || options.message.includes("Choose iOS destination")) {
          throw new Error("cancelled-by-user");
        }
        return Promise.resolve(options.initialValue || options.options[0].value);
      });

      const res = await runReleaseCommand({
        env: "prod",
        platform: "android",
        type: "store"
      });
      expect(res.status).toBe("cancelled");
    });

    it("handles track custom prompt selection", async () => {
      promptSelect.mockImplementation((options: any) => {
        if (options.message.includes("Android track") || options.message.includes("iOS destination")) {
          return Promise.resolve("__custom__");
        }
        return Promise.resolve(options.initialValue || options.options[0].value);
      });
      promptText.mockResolvedValueOnce("my_custom_track");

      const result = await runReleaseCommand({
        env: "prod",
        platform: "android",
        type: "store",
        lane: "upload_store",
        ci: true
      });
      expect(result.status).toBe("success");
      expect(result.upload?.track).toBe("my_custom_track");
    });

    it("throws error if environment not configured", async () => {
      await expect(runReleaseCommand({
        env: "invalid_env",
        platform: "android",
        type: "store"
      })).rejects.toThrow("Environment 'invalid_env' is not configured");
    });

    it("prompts for artifact path when expected hint is missing and throws on empty input", async () => {
      const configNoHint = JSON.parse(JSON.stringify(mockConfig));
      delete configNoHint.builds.store.android.outputHint;
      loadConfig.mockResolvedValueOnce(configNoHint);

      promptText.mockResolvedValueOnce(""); // Empty path input
      await expect(runReleaseCommand({
        env: "prod",
        platform: "android",
        type: "store",
        ci: true
      })).rejects.toThrow("Artifact path is required for upload");
    });

    it("throws when artifact path file does not exist", async () => {
      fs.pathExists.mockResolvedValueOnce(false); // artifact file check

      await expect(runReleaseCommand({
        env: "prod",
        platform: "android",
        type: "store",
        ci: true,
        artifactPath: "nonexistent.apk"
      })).rejects.toThrow("Artifact not found");
    });

    it("handles upload cancel/decline in non-CI mode", async () => {
      promptConfirm.mockResolvedValueOnce(false); // Run upload confirm = false

      const result = await runReleaseCommand({
        env: "prod",
        platform: "android",
        type: "store",
        ci: false
      });
      expect(result.status).toBe("cancelled");
      expect(result.message).toBe("Upload skipped by user");
    });

    it("covers rawLogs enabled and styleLine output branches", async () => {
      execa.mockReturnValue({
        all: (async function* () {
          yield Buffer.from("Uploading something...\n");
          yield Buffer.from("warning: something deprecated\n");
          yield Buffer.from("[!] failure occurred\n");
          yield Buffer.from("random stdout line\n");
          yield Buffer.from("\n"); // Empty line
        })(),
        then: (cb: any) => Promise.resolve({ exitCode: 0 }).then(cb)
      });

      const result = await runReleaseCommand({
        env: "prod",
        platform: "android",
        type: "store",
        ci: true,
        rawLogs: true
      });
      expect(result.status).toBe("success");
    });
  });
});
