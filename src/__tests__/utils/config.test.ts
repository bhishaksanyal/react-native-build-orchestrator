/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));

const { loadConfig, writeConfig } = await import("../../utils/config.js");
const fs = (await import("fs-extra")).default as any;

describe("config utility", () => {
  const MOCK_CONFIG = {
    projectName: "Test",
    environments: { dev: { vars: {} } }
  };

  it("loads config if it exists", async () => {
    fs.pathExists.mockResolvedValue(true);
    fs.readFile.mockResolvedValue(JSON.stringify(MOCK_CONFIG));
    const config = await loadConfig("/app");
    expect(config.projectName).toBe("Test");
  });

  it("throws if config missing", async () => {
    fs.pathExists.mockResolvedValue(false);
    await expect(loadConfig("/app")).rejects.toThrow(/Missing/);
  });

  it("writes config", async () => {
      await writeConfig("/app", MOCK_CONFIG as any);
      expect(fs.writeFile).toHaveBeenCalled();
  });
});
