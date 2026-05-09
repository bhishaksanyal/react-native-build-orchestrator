import { jest } from "@jest/globals";
import path from "node:path";
import fs from "fs-extra";
import type { RNBuildConfig } from "../types.js";
import { loadConfig, writeConfig, CONFIG_FILE } from "./config.js";
import { parseConfig } from "../schema.js";

jest.mock("fs-extra");
const mockedFs = fs as jest.Mocked<typeof fs>;

const BASE_ENV = { vars: { BASE_URL: "https://api.com" } };
const MOCK_CONFIG_DATA = {
  projectName: "TestApp",
  defaultEnvironment: "production",
  environments: { production: BASE_ENV },
  fastlane: {},
  builds: {
    development: {},
    adhoc: {},
    store: {
      android: { enabled: true, command: "gradlew bundleRelease" },
    },
  },
};

describe("config and schema utils", () => {
  describe("validation", () => {
    it("validates correct config", () => {
      expect(() => parseConfig(MOCK_CONFIG_DATA)).not.toThrow();
    });

    it("fails if environment is missing", () => {
      const cfg = { ...MOCK_CONFIG_DATA, defaultEnvironment: "staging" };
      expect(() => parseConfig(cfg)).toThrow(/defaultEnvironment must match/);
    });

    it("handles flavors", () => {
      const flavorCfg = {
        ...MOCK_CONFIG_DATA,
        flavors: {
          android: {
            default: "clientA",
            options: ["clientA", "clientB"],
            commandMap: { clientA: "ClientA" },
          },
        },
      };
      expect(() => parseConfig(flavorCfg)).not.toThrow();
    });

    it("fails on invalid flavor default", () => {
      const badFlavor = {
        ...MOCK_CONFIG_DATA,
        flavors: {
          android: { default: "unknown", options: ["clientA"] },
        },
      };
      expect(() => parseConfig(badFlavor)).toThrow(/default android flavor must match/);
    });
  });

  describe("file ops", () => {
    const projectDir = "/test/project";
    const configPath = path.join(projectDir, CONFIG_FILE);

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("loads config", async () => {
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.readFile.mockResolvedValue(JSON.stringify(MOCK_CONFIG_DATA) as never);

      const config = await loadConfig(projectDir);
      expect(config.projectName).toBe("TestApp");
      expect(mockedFs.readFile).toHaveBeenCalledWith(configPath, "utf8");
    });

    it("errors if missing", async () => {
      mockedFs.pathExists.mockResolvedValue(false as never);
      await expect(loadConfig(projectDir)).rejects.toThrow(/Missing .rnbuildrc.yml/);
    });

    it("writes yaml", async () => {
      mockedFs.writeFile.mockResolvedValue(undefined as never);

      const res = await writeConfig(projectDir, MOCK_CONFIG_DATA as unknown as RNBuildConfig);
      expect(res).toBe(configPath);
      expect(mockedFs.writeFile).toHaveBeenCalledWith(configPath, expect.stringContaining("projectName: TestApp"), "utf8");
    });
  });
});
