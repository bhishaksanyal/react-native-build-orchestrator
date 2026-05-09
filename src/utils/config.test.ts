import { jest } from "@jest/globals";
import path from "node:path";
import fs from "fs-extra";
import type { RNBuildConfig } from "../types.js";
import { loadConfig, writeConfig, CONFIG_FILE } from "./config.js";

jest.mock("fs-extra");
const mockedFs = fs as jest.Mocked<typeof fs>;

describe("config utils", () => {
  const projectDir = "/test/project";
  const configPath = path.join(projectDir, CONFIG_FILE);

  const mockConfig = {
    projectName: "TestApp",
    defaultEnvironment: "production",
    environments: {
      production: { vars: {} },
    },
    fastlane: {},
    builds: {
      development: {},
      adhoc: {},
      store: {},
    },
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("loadConfig", () => {
    it("should load and parse config file", async () => {
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.readFile.mockResolvedValue(JSON.stringify(mockConfig) as never);

      const config = await loadConfig(projectDir);
      expect(config.projectName).toBe("TestApp");
      expect(mockedFs.readFile).toHaveBeenCalledWith(configPath, "utf8");
    });

    it("should throw if config file does not exist", async () => {
      mockedFs.pathExists.mockResolvedValue(false as never);

      await expect(loadConfig(projectDir)).rejects.toThrow(/Missing .rnbuildrc.yml/);
    });
  });

  describe("writeConfig", () => {
    it("should write config to yaml", async () => {
      mockedFs.writeFile.mockResolvedValue(undefined as never);

      const resultPath = await writeConfig(projectDir, mockConfig as unknown as RNBuildConfig);
      expect(resultPath).toBe(configPath);
      expect(mockedFs.writeFile).toHaveBeenCalledWith(configPath, expect.stringContaining("projectName: TestApp"), "utf8");
    });
  });
});
