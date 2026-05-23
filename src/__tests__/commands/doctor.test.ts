/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

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

const { runDoctorCommand } = await import("../../commands/doctor.js");
const fs = (await import("fs-extra")).default as any;

describe("doctor command", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reports success when all files exist", async () => {
    fs.pathExists.mockResolvedValue(true);
    const result = await runDoctorCommand();
    expect(result.status).toBe("success");
    expect(result.checks!.packageJson).toBe(true);
    expect(fs.pathExists).toHaveBeenCalled();
    await expect(runDoctorCommand()).resolves.toBeDefined();
  });

  it("reports error when config is missing", async () => {
    fs.pathExists.mockImplementation((p: string) => {
        if (p.endsWith(".rnbuildrc.yml")) return Promise.resolve(false);
        return Promise.resolve(true);
    });
    const result = await runDoctorCommand();
    expect(result.status).toBe("error");
    expect(result.message).toContain(".rnbuildrc.yml");
    expect(fs.pathExists).toHaveBeenCalled();
  });

  it("reports error when package.json is missing", async () => {
    fs.pathExists.mockImplementation((p: string) => {
        if (p.endsWith("package.json")) return Promise.resolve(false);
        return Promise.resolve(true);
    });
    const result = await runDoctorCommand();
    expect(result.status).toBe("error");
    expect(result.message).toContain("package.json");
  });

  it("reports error when both android and ios folders are missing", async () => {
    fs.pathExists.mockImplementation((p: string) => {
        if (p.endsWith("android") || p.endsWith("ios")) return Promise.resolve(false);
        return Promise.resolve(true);
    });
    const result = await runDoctorCommand();
    expect(result.status).toBe("error");
    expect(result.message).toContain("native folders");
  });

  it("handles custom cwd", async () => {
      fs.pathExists.mockResolvedValue(true);
      const result = await runDoctorCommand("/tmp/test");
      expect(result.status).toBe("success");
      expect(fs.pathExists).toHaveBeenCalledWith(expect.stringContaining("/tmp/test"));
  });
});
