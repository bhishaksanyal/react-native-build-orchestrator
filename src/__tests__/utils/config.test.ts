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
const { parseConfig } = await import("../../schema.js");
const fs = (await import("fs-extra")).default as any;

describe("config utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const MOCK_CONFIG = {
    projectName: "Test",
    defaultEnvironment: "dev",
    environments: { dev: { vars: {} } },
    builds: {
      development: { android: { enabled: true, command: "build" } },
      adhoc: { android: { enabled: true, command: "build" } },
      store: { android: { enabled: true, command: "build" } }
    }
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

  describe("schema validation", () => {
    it("throws when defaultEnvironment is not in environments", () => {
      const invalidConfig = {
        ...MOCK_CONFIG,
        defaultEnvironment: "missing"
      };
      expect(() => parseConfig(invalidConfig)).toThrow(/defaultEnvironment must match/);
    });

    it("throws when flavor default is not in options", () => {
      const invalidConfig = {
        ...MOCK_CONFIG,
        flavors: {
          android: {
            options: ["dev"],
            default: "prod"
          }
        }
      };
      expect(() => parseConfig(invalidConfig)).toThrow(/default android flavor must match/);
    });

    it("throws when flavor commandMap key is not in options", () => {
      const invalidConfig = {
        ...MOCK_CONFIG,
        flavors: {
          android: {
            options: ["dev"],
            default: "dev",
            commandMap: {
              prod: "prodFlavor"
            }
          }
        }
      };
      expect(() => parseConfig(invalidConfig)).toThrow(/mapped android flavor must exist/);
    });
  });
});
