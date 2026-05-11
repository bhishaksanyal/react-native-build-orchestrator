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
  });
});
