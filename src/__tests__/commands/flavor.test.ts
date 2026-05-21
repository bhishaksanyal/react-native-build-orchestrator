/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

const CANCEL_SYMBOL = Symbol('cancel');

jest.unstable_mockModule("../../utils/logger.js", () => ({
  intro: jest.fn(),
  outro: jest.fn(),
  log: jest.fn(),
  promptConfirm: jest.fn(),
  promptSelect: jest.fn(),
  promptText: jest.fn(),
  isCancel: jest.fn().mockImplementation((v: any) => v === CANCEL_SYMBOL)
}));

jest.unstable_mockModule("../../utils/config.js", () => ({
  loadConfig: jest.fn<any>(),
  writeConfig: jest.fn<any>()
}));

jest.unstable_mockModule("../../utils/flavor-detection.js", () => ({
  detectAndroidFlavors: jest.fn<any>(),
  detectIosSchemes: jest.fn<any>()
}));

const { runFlavorCommand } = await import("../../commands/flavor.js");
const { loadConfig, writeConfig } = await import("../../utils/config.js") as any;
const { promptSelect, promptConfirm, promptText } = await import("../../utils/logger.js") as any;
const { detectAndroidFlavors, detectIosSchemes } = await import("../../utils/flavor-detection.js") as any;

describe("flavor command", () => {
  const mockConfig = {
    projectName: "MyApp",
    flavors: {
      android: { options: ["dev", "prod"], default: "dev" }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    loadConfig.mockImplementation(() => Promise.resolve(JSON.parse(JSON.stringify(mockConfig))));

    // Default mock implementations
    promptSelect.mockImplementation(async (options: any) => {
        return options.initialValue || options.options[0]?.value;
    });
    promptConfirm.mockImplementation(async (options: any) => {
        return options.initialValue ?? true;
    });
    promptText.mockImplementation(async (options: any) => {
        return options.defaultValue || options.placeholder || "text";
    });
  });

  it("lists flavors", async () => {
    const result = await runFlavorCommand("list");
    expect(result.status).toBe("success");
  });

  it("adds a flavor", async () => {
    promptText.mockResolvedValueOnce("newFlavor").mockResolvedValueOnce("newFlavor");
    const result = await runFlavorCommand("add", "android");
    expect(result.status).toBe("success");
    expect(writeConfig).toHaveBeenCalled();
  });

  it("edits a flavor (rename)", async () => {
    promptSelect.mockResolvedValueOnce("android")
                .mockResolvedValueOnce("dev")
                .mockResolvedValueOnce("rename");
    promptText.mockResolvedValueOnce("renamedDev");
    const result = await runFlavorCommand("edit");
    expect(result.status).toBe("success");
    expect(writeConfig).toHaveBeenCalled();
  });

  it("edits a flavor (command mapping)", async () => {
      promptSelect.mockResolvedValueOnce("android")
                  .mockResolvedValueOnce("dev")
                  .mockResolvedValueOnce("command-value");
      promptText.mockResolvedValueOnce("devTask");
      const result = await runFlavorCommand("edit");
      expect(result.status).toBe("success");
      expect(writeConfig).toHaveBeenCalled();
  });

  it("removes a flavor", async () => {
    promptSelect.mockResolvedValueOnce("android")
                .mockResolvedValueOnce("prod");
    promptConfirm.mockResolvedValueOnce(true);
    const result = await runFlavorCommand("remove");
    expect(result.status).toBe("success");
    expect(writeConfig).toHaveBeenCalled();
  });

  it("sets default flavor", async () => {
    const result = await runFlavorCommand("set-default", "android", "prod");
    expect(result.status).toBe("success");
    expect(writeConfig).toHaveBeenCalled();
  });

  it("detects flavors", async () => {
    detectAndroidFlavors.mockResolvedValue({ options: ["d1"], default: "d1" });
    detectIosSchemes.mockResolvedValue({ options: ["s1"], default: "s1" });
    const result = await runFlavorCommand("detect");
    expect(result.status).toBe("success");
    expect(writeConfig).toHaveBeenCalled();
  });

  it("handles cancellation when no action is passed", async () => {
    promptSelect.mockResolvedValueOnce(CANCEL_SYMBOL);
    const result = await runFlavorCommand(undefined);
    expect(result.status).toBe("cancelled");
  });

  it("throws error when removing default flavor with other options present", async () => {
      await expect(runFlavorCommand("remove", "android", "dev")).rejects.toThrow("Cannot remove default");
  });

  it("throws error when flavor name is empty", async () => {
      promptSelect.mockResolvedValueOnce("android");
      promptText.mockResolvedValueOnce("");
      await expect(runFlavorCommand("add")).rejects.toThrow("Flavor name cannot be empty");
  });

  describe("flavor command edge cases", () => {
    it("handles ensureFlavorPlatform when flavors object is missing from config", async () => {
      const configNoFlavors = { projectName: "Test" };
      loadConfig.mockImplementation(() => Promise.resolve(configNoFlavors as any));
      promptText.mockResolvedValueOnce("newFlavor").mockResolvedValueOnce("newFlavor");
      const result = await runFlavorCommand("add", "android");
      expect(result.status).toBe("success");
      expect(writeConfig).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        flavors: {
          android: expect.objectContaining({
            options: ["newFlavor"]
          })
        }
      }));
    });

    it("throws if requireExisting platform fails due to no flavor config at all", async () => {
      const configNoFlavors = { projectName: "Test" };
      loadConfig.mockImplementation(() => Promise.resolve(configNoFlavors as any));
      await expect(runFlavorCommand("edit")).rejects.toThrow("No flavors configured yet. Add a flavor first.");
    });

    it("throws if requireExisting platform fails for specified platform", async () => {
      const configNoAndroid = {
        projectName: "Test",
        flavors: { ios: { options: ["App"], default: "App" } }
      };
      loadConfig.mockImplementation(() => Promise.resolve(configNoAndroid as any));
      await expect(runFlavorCommand("edit", "android")).rejects.toThrow("No android flavors configured.");
    });

    it("throws when adding a flavor that already exists", async () => {
      await expect(runFlavorCommand("add", "android", "prod")).rejects.toThrow("already exists");
    });

    it("throws when renaming a flavor to a name that already exists", async () => {
      promptSelect.mockResolvedValueOnce("android") // platform
                  .mockResolvedValueOnce("prod")    // flavor
                  .mockResolvedValueOnce("rename"); // action
      promptText.mockResolvedValueOnce("dev"); // renaming prod to dev (dev already exists)
      await expect(runFlavorCommand("edit")).rejects.toThrow("already exists");
    });

    it("handles edit mapping cleanup when mapped value is empty or same as flavor name", async () => {
      // 1. empty mapped value removes key from commandMap
      promptSelect.mockResolvedValueOnce("android")
                  .mockResolvedValueOnce("prod")
                  .mockResolvedValueOnce("command-value");
      promptText.mockResolvedValueOnce(""); // empty
      await runFlavorCommand("edit");

      // 2. same value removes key from commandMap
      promptSelect.mockResolvedValueOnce("android")
                  .mockResolvedValueOnce("prod")
                  .mockResolvedValueOnce("command-value");
      promptText.mockResolvedValueOnce("prod"); // same as name
      await runFlavorCommand("edit");
      expect(writeConfig).toHaveBeenCalled();
    });

    it("handles remove flavor cancellation and commandMap cleanup", async () => {
      // cancel
      promptSelect.mockResolvedValueOnce("android")
                  .mockResolvedValueOnce("prod");
      promptConfirm.mockResolvedValueOnce(false);
      await runFlavorCommand("remove");
      expect(writeConfig).not.toHaveBeenCalled();
    });

    it("handles remove flavor when it is the last flavor and cleans up config objects", async () => {
      const configSingleFlavor = {
        projectName: "Test",
        flavors: {
          android: { options: ["prod"], default: "prod" }
        }
      };
      loadConfig.mockImplementation(() => Promise.resolve(configSingleFlavor as any));
      promptConfirm.mockResolvedValueOnce(true); // shouldRemove = true
      await runFlavorCommand("remove", "android", "prod");
      expect(writeConfig).toHaveBeenCalledWith(expect.any(String), expect.not.objectContaining({
        flavors: expect.any(Object)
      }));
    });

    it("handles detect when no flavors are detected", async () => {
      detectAndroidFlavors.mockResolvedValueOnce(undefined);
      detectIosSchemes.mockResolvedValueOnce(undefined);
      const res = await runFlavorCommand("detect");
      expect(res.status).toBe("success");
    });

    it("handles detect when user declines import", async () => {
      detectAndroidFlavors.mockResolvedValueOnce({ options: ["f1"], default: "f1" });
      detectIosSchemes.mockResolvedValueOnce({ options: ["s1"], default: "s1" });
      promptConfirm.mockResolvedValueOnce(false); // import = false
      const res = await runFlavorCommand("detect");
      expect(res.status).toBe("success");
      expect(writeConfig).not.toHaveBeenCalled();
    });

    it("handles list when platform has no flavors", async () => {
        const configNoAndroidFlavors = {
            projectName: "Test",
            flavors: { ios: { options: ["App"], default: "App" } }
        };
        loadConfig.mockResolvedValueOnce(configNoAndroidFlavors as any);
        const res = await runFlavorCommand("list");
        expect(res.status).toBe("success");
    });

    it("handles add when commandMap already exists", async () => {
        const configWithCommandMap = {
            projectName: "Test",
            flavors: {
                android: { options: ["dev"], default: "dev", commandMap: { dev: "DevTask" } }
            }
        };
        loadConfig.mockImplementation(() => Promise.resolve(JSON.parse(JSON.stringify(configWithCommandMap))));
        promptSelect.mockResolvedValueOnce("android");
        promptText.mockResolvedValueOnce("newFlavor").mockResolvedValueOnce("newFlavorTask");
        promptConfirm.mockResolvedValueOnce(true);
        const res = await runFlavorCommand("add");
        expect(res.status).toBe("success");
        expect(writeConfig).toHaveBeenCalled();
    });

    it("handles edit command-value and deletes commandMap if empty", async () => {
        const configWithSingleCommandMap = {
            projectName: "Test",
            flavors: {
                android: { options: ["dev"], default: "dev", commandMap: { dev: "DevTask" } }
            }
        };
        loadConfig.mockImplementation(() => Promise.resolve(JSON.parse(JSON.stringify(configWithSingleCommandMap))));
        promptSelect.mockResolvedValueOnce("android").mockResolvedValueOnce("dev").mockResolvedValueOnce("command-value");
        promptText.mockResolvedValueOnce("dev"); // same as name, should delete from commandMap
        await runFlavorCommand("edit");
        expect(writeConfig).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            flavors: {
                android: expect.not.objectContaining({
                    commandMap: expect.any(Object)
                })
            }
        }));
    });

    it("handles remove and deletes commandMap if empty", async () => {
        const configWithSingleCommandMap = {
            projectName: "Test",
            flavors: {
                android: { options: ["dev", "prod"], default: "prod", commandMap: { dev: "DevTask" } }
            }
        };
        loadConfig.mockImplementation(() => Promise.resolve(JSON.parse(JSON.stringify(configWithSingleCommandMap))));
        promptConfirm.mockResolvedValueOnce(true);
        await runFlavorCommand("remove", "android", "dev");
        expect(writeConfig).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            flavors: {
                android: expect.not.objectContaining({
                    commandMap: expect.any(Object)
                })
            }
        }));
    });
  });
});
