/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: jest.fn<any>(),
    ensureDir: jest.fn<any>(),
    writeFile: jest.fn<any>()
  }
}));
jest.unstable_mockModule("../../utils/config.js", () => ({
  loadConfig: jest.fn<any>(),
  writeConfig: jest.fn<any>()
}));
jest.unstable_mockModule("@clack/prompts", () => ({
  confirm: jest.fn<any>(),
  intro: jest.fn<any>(),
  isCancel: jest.fn<any>().mockImplementation((v: any) => v === "__CANCEL__"),
  outro: jest.fn<any>(),
  spinner: jest.fn<any>(),
  note: jest.fn<any>(),
  select: jest.fn<any>(),
  text: jest.fn<any>()
}));

const { runFastlaneSetupCommand } = await import("../../commands/fastlane.js");
const { loadConfig } = await import("../../utils/config.js") as any;
const { confirm, spinner } = await import("@clack/prompts") as any;
const fs = (await import("fs-extra")).default as any;

const FASTLANE_CONFIG = {
  projectName: "MyApp",
  fastlane: {
    android: { lane: "upload", defaultTrack: "internal" },
    ios: { lane: "upload", defaultTrack: "testflight" }
  }
};

describe("fastlane command", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
    });
    fs.pathExists.mockResolvedValue(false);
    confirm.mockResolvedValue(true);
    spinner.mockReturnValue({ start: jest.fn(), stop: jest.fn() });
  });

  afterEach(() => {
      jest.restoreAllMocks();
  });

  it("sets up fastlane files", async () => {
    loadConfig.mockResolvedValue(FASTLANE_CONFIG);
    await runFastlaneSetupCommand({ force: false });
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it("handles existing files with force", async () => {
      loadConfig.mockResolvedValue(FASTLANE_CONFIG);
      fs.pathExists.mockResolvedValue(true);
      await runFastlaneSetupCommand({ force: true });
      expect(fs.writeFile).toHaveBeenCalled();
  });

  it("handles cancel", async () => {
      loadConfig.mockResolvedValue(FASTLANE_CONFIG);
      confirm.mockResolvedValue("__CANCEL__");
      await expect(runFastlaneSetupCommand({ force: false })).rejects.toThrow("Operation cancelled");
      expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it("skips when user declines all platforms", async () => {
      loadConfig.mockResolvedValue({ projectName: "MyApp" });
      confirm.mockResolvedValue(false);
      await runFastlaneSetupCommand({ force: false });
      expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it("handles existing files and user declines overwrite", async () => {
      loadConfig.mockResolvedValue(FASTLANE_CONFIG);
      fs.pathExists.mockResolvedValue(true);
      // first 2 confirms for useAndroid/useIos (true by default in mock setup),
      // 3rd confirm for overwrite (false)
      confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      const result = await runFastlaneSetupCommand({ force: false });
      expect(result.status).toBe("success");
      expect(result.filesOverwritten).toBe(false);
      expect(fs.writeFile).not.toHaveBeenCalled();
  });
});
