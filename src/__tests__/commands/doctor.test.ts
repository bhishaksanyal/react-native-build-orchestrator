/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("execa", () => ({
  execa: jest.fn<any>()
}));

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: jest.fn<any>()
  }
}));

jest.unstable_mockModule("../../utils/logger.js", () => ({
  intro: jest.fn(),
  outro: jest.fn(),
  log: jest.fn(),
  setCiMode: jest.fn(),
  getCiMode: jest.fn()
}));

jest.unstable_mockModule("../../utils/config.js", () => ({
  loadConfig: jest.fn<any>()
}));

const { runDoctorCommand } = await import("../../commands/doctor.js");
const fs = (await import("fs-extra")).default as any;
const { execa } = await import("execa") as any;
const { loadConfig } = await import("../../utils/config.js") as any;

describe("doctor command", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reports success with all checks passing", async () => {
    fs.pathExists.mockResolvedValue(true);
    execa.mockResolvedValue({});
    loadConfig.mockResolvedValue({
      fastlane: {
        android: { lane: "upload_store", defaultTrack: "internal" },
        ios: { lane: "upload_store", defaultTrack: "testflight" }
      }
    });

    const result = await runDoctorCommand();
    expect(result.status).toBe("success");
    expect(result.checks!.packageJson).toBe(true);
    expect(result.checks!.ruby).toBe(true);
    expect(result.checks!.bundler).toBe(true);
    expect(result.checks!.fastlaneCli).toBe(true);
    expect(result.checks!.gemfile).toBe(true);
    expect(result.checks!.fastlaneDir).toBe(true);
    expect(result.checks!.fastlaneConfig).toBe(true);
    expect(fs.pathExists).toHaveBeenCalled();
    expect(execa).toHaveBeenCalled();
  });

  it("reports error when config is missing", async () => {
    fs.pathExists.mockImplementation((p: string) => {
        if (p.endsWith(".rnbuildrc.yml")) return Promise.resolve(false);
        return Promise.resolve(true);
    });
    execa.mockResolvedValue({});
    loadConfig.mockRejectedValue(new Error("Config not found"));

    const result = await runDoctorCommand();
    expect(result.status).toBe("error");
    expect(result.message).toContain(".rnbuildrc.yml");
    expect(result.checks!.fastlaneConfig).toBe(false);
    expect(fs.pathExists).toHaveBeenCalled();
  });

  it("reports error when package.json is missing", async () => {
    fs.pathExists.mockImplementation((p: string) => {
        if (p.endsWith("package.json")) return Promise.resolve(false);
        return Promise.resolve(true);
    });
    execa.mockResolvedValue({});
    loadConfig.mockResolvedValue({ fastlane: { android: {} } });

    const result = await runDoctorCommand();
    expect(result.status).toBe("error");
    expect(result.message).toContain("package.json");
  });

  it("reports error when both android and ios folders are missing", async () => {
    fs.pathExists.mockImplementation((p: string) => {
        if (p.endsWith("android") || p.endsWith("ios")) return Promise.resolve(false);
        return Promise.resolve(true);
    });
    execa.mockResolvedValue({});
    loadConfig.mockResolvedValue({ fastlane: { android: {} } });

    const result = await runDoctorCommand();
    expect(result.status).toBe("error");
    expect(result.message).toContain("native folders");
  });

  it("reports ruby/bundler/fastlane as missing when commands not found", async () => {
    fs.pathExists.mockResolvedValue(true);
    execa.mockRejectedValue(new Error("Command not found"));
    loadConfig.mockResolvedValue({});  // No fastlane config

    const result = await runDoctorCommand();
    expect(result.status).toBe("success");
    expect(result.checks!.ruby).toBe(false);
    expect(result.checks!.bundler).toBe(false);
    expect(result.checks!.fastlaneCli).toBe(false);
    expect(result.checks!.fastlaneConfig).toBe(false);
  });

  it("handles custom cwd", async () => {
      fs.pathExists.mockResolvedValue(true);
      execa.mockResolvedValue({});
      loadConfig.mockResolvedValue({ fastlane: { android: {} } });

      const result = await runDoctorCommand("/app/test");
      expect(result.status).toBe("success");
      expect(fs.pathExists).toHaveBeenCalledWith(expect.stringContaining("/app/test"));
  });
});
