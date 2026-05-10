/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("execa", () => ({ execa: jest.fn() }));
jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: jest.fn(),
    ensureDir: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn()
  }
}));
jest.unstable_mockModule("../../utils/config.js", () => ({ loadConfig: jest.fn() }));
jest.unstable_mockModule("@clack/prompts", () => ({
  confirm: jest.fn(),
  intro: jest.fn(),
  isCancel: jest.fn(),
  outro: jest.fn(),
  select: jest.fn(),
  spinner: jest.fn(),
  note: jest.fn(),
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
jest.unstable_mockModule("../../commands/build.js", () => ({
  runBuildCommand: jest.fn()
}));

const { runReleaseCommand } = await import("../../commands/release.js");
const { loadConfig } = await import("../../utils/config.js") as any;
const { confirm, isCancel, select, spinner } = await import("@clack/prompts") as any;
const { execa } = await import("execa") as any;
const { createRuntimeVars, writeRuntimeEnvExports } = await import("../../utils/runtime-exports.js") as any;
const { interpolate, readDotEnv } = await import("../../utils/env.js") as any;
const { runBuildCommand } = await import("../../commands/build.js") as any;
const fs = (await import("fs-extra")).default as any;

describe("release command", () => {
  const MOCK_CONFIG = {
    projectName: "Test",
    defaultEnvironment: "prod",
    environments: { prod: { vars: {}, envFile: ".env" } },
    flavors: {
        android: { options: ["free"], default: "free" },
        ios: { options: ["App"], default: "App" }
    },
    builds: {
      store: {
        android: { enabled: true, command: "gradlew", outputHint: "hint.apk", androidArtifact: "bundle" as const },
        ios: { enabled: true, command: "xcodebuild", outputHint: "hint.app" }
      }
    },
    release: {
        android: { lane: "android_lane", track: "internal" },
        ios: { lane: "ios_lane", track: "testflight" }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    loadConfig.mockResolvedValue(MOCK_CONFIG);
    select.mockImplementation((o: any) => {
        if (o.message.includes("environment")) return Promise.resolve("prod");
        if (o.message.includes("type")) return Promise.resolve("store");
        if (o.message.includes("platform")) return Promise.resolve("android");
        return Promise.resolve("free");
    });
    confirm.mockResolvedValue(true);
    spinner.mockReturnValue({ start: jest.fn(), stop: jest.fn() });
    isCancel.mockImplementation((v: any) => typeof v === "symbol");
    fs.pathExists.mockResolvedValue(true);
    fs.readFile.mockResolvedValue("content");

    execa.mockReturnValue({
        all: (async function* () { yield "ok"; })(),
        exitCode: 0
    } as any);

    runBuildCommand.mockResolvedValue(undefined);

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

  it("executes release for android", async () => {
    await runReleaseCommand({ platform: "android", env: "prod" });
    expect(execa).toHaveBeenCalledWith(expect.stringContaining("fastlane android"), expect.any(Object));
  });

  it("executes release for ios", async () => {
      select.mockImplementation((o: any) => {
          if (o.message.includes("environment")) return Promise.resolve("prod");
          if (o.message.includes("type")) return Promise.resolve("store");
          if (o.message.includes("platform")) return Promise.resolve("ios");
          return Promise.resolve("App");
      });
      await runReleaseCommand({});
      expect(execa).toHaveBeenCalledWith(expect.stringContaining("fastlane ios"), expect.any(Object));
  });

  it("handles dry run", async () => {
      await runReleaseCommand({ platform: "android", dryRun: true });
      expect(runBuildCommand).toHaveBeenCalled();
      expect(execa).not.toHaveBeenCalled();
  });

  it("handles cancel", async () => {
      select.mockResolvedValue(Symbol("cancel"));
      await runReleaseCommand({});
      expect(execa).not.toHaveBeenCalled();
  });

  it("throws for missing release config", async () => {
      const config = JSON.parse(JSON.stringify(MOCK_CONFIG));
      delete config.release;
      loadConfig.mockResolvedValue(config);
      await expect(runReleaseCommand({ platform: "android" })).rejects.toThrow(/not configured/);
  });

  it("handles build failure", async () => {
      runBuildCommand.mockRejectedValue(new Error("build failed"));
      await expect(runReleaseCommand({ platform: "android" })).rejects.toThrow(/build failed/);
  });

  it("handles fastlane failure", async () => {
      execa.mockReturnValue({ all: (async function* () { yield "fail"; })(), exitCode: 1 } as any);
      await expect(runReleaseCommand({ platform: "android" })).rejects.toThrow(/Fastlane upload failed/);
  });

  it("handles ci mode", async () => {
      await runReleaseCommand({ platform: "android", ci: true });
      expect(confirm).not.toHaveBeenCalled();
  });
});
