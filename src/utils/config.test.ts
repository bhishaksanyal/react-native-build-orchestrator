import { jest } from "@jest/globals";
import path from "node:path";
import fs from "fs-extra";
import type { RNBuildConfig } from "../types.js";
import { loadConfig, writeConfig, CONFIG_FILE } from "./config.js";
import { parseConfig } from "../schema.js";

jest.mock("fs-extra");
const mockedFs = fs as jest.Mocked<typeof fs>;

const MOCK_CONFIG = {
  projectName: "TestApp",
  defaultEnvironment: "production",
  environments: {
    production: { vars: { BASE_URL: "https://api.com" } },
  },
  fastlane: {},
  builds: {
    development: {},
    adhoc: {},
    store: {
      android: {
        enabled: true,
        command: "gradlew bundleRelease",
      },
    },
  },
};

describe("config and schema utils", () => {
  describe("schema validation", () => {
    it("should validate a correct config", () => {
      expect(() => parseConfig(MOCK_CONFIG)).not.toThrow();
    });

    it("should throw if defaultEnvironment is missing from environments", () => {
      const invalidConfig = {
        ...MOCK_CONFIG,
        defaultEnvironment: "staging",
      };
      expect(() => parseConfig(invalidConfig)).toThrow(/defaultEnvironment must match/);
    });

    it("should validate flavor configurations", () => {
      const configWithFlavors = {
        ...MOCK_CONFIG,
        flavors: {
          android: {
            default: "clientA",
            options: ["clientA", "clientB"],
            commandMap: {
              clientA: "ClientA",
            },
          },
        },
      };
      expect(() => parseConfig(configWithFlavors)).not.toThrow();
    });

    it("should throw if flavor default is not in options", () => {
      const invalidConfig = {
        ...MOCK_CONFIG,
        flavors: {
          android: {
            default: "unknown",
            options: ["clientA"],
          },
        },
      };
      expect(() => parseConfig(invalidConfig)).toThrow(/default android flavor must match/);
    });
  });

  describe("config file operations", () => {
    const projectDir = "/test/project";
    const configPath = path.join(projectDir, CONFIG_FILE);

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should load and parse config file", async () => {
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.readFile.mockResolvedValue(JSON.stringify(MOCK_CONFIG) as never);

      const config = await loadConfig(projectDir);
      expect(config.projectName).toBe("TestApp");
      expect(mockedFs.readFile).toHaveBeenCalledWith(configPath, "utf8");
    });

    it("should throw if config file does not exist", async () => {
      mockedFs.pathExists.mockResolvedValue(false as never);

      await expect(loadConfig(projectDir)).rejects.toThrow(/Missing .rnbuildrc.yml/);
    });

    it("should write config to yaml", async () => {
      mockedFs.writeFile.mockResolvedValue(undefined as never);

      const resultPath = await writeConfig(projectDir, MOCK_CONFIG as unknown as RNBuildConfig);
      expect(resultPath).toBe(configPath);
      expect(mockedFs.writeFile).toHaveBeenCalledWith(configPath, expect.stringContaining("projectName: TestApp"), "utf8");
    });
  });
});
