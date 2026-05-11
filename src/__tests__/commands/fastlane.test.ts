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

describe("fastlane command", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.pathExists.mockResolvedValue(false);
    confirm.mockResolvedValue(true);
    spinner.mockReturnValue({ start: jest.fn(), stop: jest.fn() });
  });

  it("sets up fastlane files", async () => {
    loadConfig.mockResolvedValue({
        projectName: "MyApp",
        fastlane: {
            android: { lane: "upload", defaultTrack: "internal" },
            ios: { lane: "upload", defaultTrack: "testflight" }
        }
    });
    await runFastlaneSetupCommand({ force: false });
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it("handles existing files with force", async () => {
      loadConfig.mockResolvedValue({
          projectName: "MyApp",
          fastlane: {
              android: { lane: "upload", defaultTrack: "internal" },
              ios: { lane: "upload", defaultTrack: "testflight" }
          }
      });
      fs.pathExists.mockResolvedValue(true);
      await runFastlaneSetupCommand({ force: true });
      expect(fs.writeFile).toHaveBeenCalled();
  });

  it("handles cancel", async () => {
      loadConfig.mockResolvedValue({
          projectName: "MyApp",
          fastlane: {
              android: { lane: "upload", defaultTrack: "internal" },
              ios: { lane: "upload", defaultTrack: "testflight" }
          }
      });
      confirm.mockResolvedValue("__CANCEL__");
      await runFastlaneSetupCommand({ force: false });
      expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it("skips when user declines all platforms", async () => {
      loadConfig.mockResolvedValue({ projectName: "MyApp" });
      confirm.mockResolvedValue(false);
      await runFastlaneSetupCommand({ force: false });
      expect(fs.writeFile).not.toHaveBeenCalled();
  });
});
