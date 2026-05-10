/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/config.js", () => ({
  loadConfig: jest.fn()
}));
jest.unstable_mockModule("../../utils/env.js", () => ({
  readDotEnv: jest.fn()
}));
jest.unstable_mockModule("../../utils/runtime-exports.js", () => ({
  createRuntimeVars: jest.fn(),
  writeRuntimeEnvExports: jest.fn()
}));

const { syncRuntimeEnvFromConfig } = await import("../../utils/sync-runtime-env.js");
const { loadConfig } = await import("../../utils/config.js") as any;
const { readDotEnv } = await import("../../utils/env.js") as any;
const { createRuntimeVars, writeRuntimeEnvExports } = await import("../../utils/runtime-exports.js") as any;

describe("sync runtime env", () => {
  const MOCK_CONFIG = {
    projectName: "Test",
    defaultEnvironment: "dev",
    environments: { dev: { vars: { A: "1" }, envFile: ".env" } }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    loadConfig.mockResolvedValue(MOCK_CONFIG);
    readDotEnv.mockResolvedValue({ FILE: "val" });
    createRuntimeVars.mockReturnValue({ KEY: "VAL" });
    writeRuntimeEnvExports.mockResolvedValue({ runtimeEnvFilePath: "active.env" });
  });

  it("syncs default environment by default", async () => {
    await syncRuntimeEnvFromConfig("/app", MOCK_CONFIG as any);
    expect(writeRuntimeEnvExports).toHaveBeenCalled();
  });
});
