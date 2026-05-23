/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: jest.fn<any>(),
    writeFile: jest.fn<any>(),
    readdir: jest.fn<any>(),
    readFile: jest.fn<any>(),
    ensureDir: jest.fn<any>(),
    stat: jest.fn<any>(),
    readJson: jest.fn<any>()
  }
}));
jest.unstable_mockModule("../../utils/config.js", () => ({
  writeConfig: jest.fn<any>(),
  CONFIG_FILE: ".rnbuildrc.yml"
}));
jest.unstable_mockModule("@clack/prompts", () => ({
  confirm: jest.fn<any>(),
  intro: jest.fn<any>(),
  isCancel: jest.fn<any>().mockImplementation((v: any) => v === "__CANCEL__"),
  outro: jest.fn<any>(),
  select: jest.fn<any>(),
  text: jest.fn<any>(),
  spinner: jest.fn<any>(),
  note: jest.fn<any>()
}));
jest.unstable_mockModule("../../utils/flavor-detection.js", () => ({
  detectAndroidFlavors: jest.fn<any>(),
  detectIosSchemes: jest.fn<any>()
}));
jest.unstable_mockModule("../../utils/environment-detection.js", () => ({
  detectEnvironmentsFromDotEnv: jest.fn<any>()
}));

const { runInitCommand } = await import("../../commands/init.js");
const { writeConfig } = await import("../../utils/config.js") as any;
const { confirm, text, spinner } = await import("@clack/prompts") as any;
const { detectAndroidFlavors, detectIosSchemes } = await import("../../utils/flavor-detection.js") as any;
const { detectEnvironmentsFromDotEnv } = await import("../../utils/environment-detection.js") as any;
const fs = (await import("fs-extra")).default as any;

describe("init command", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    fs.pathExists.mockResolvedValue(false);
    fs.readdir.mockResolvedValue([]);
    fs.readFile.mockResolvedValue("KEY=VAL");
    fs.ensureDir.mockResolvedValue(undefined);
    fs.stat.mockResolvedValue({ isDirectory: () => true });
    text.mockResolvedValue("MyApp");
    confirm.mockResolvedValue(true);
    spinner.mockReturnValue({ start: jest.fn(), stop: jest.fn() });

    detectAndroidFlavors.mockResolvedValue(undefined);
    detectIosSchemes.mockResolvedValue(undefined);
    detectEnvironmentsFromDotEnv.mockResolvedValue({});
  });

  it("initializes a new project", async () => {
    await runInitCommand({ force: false });
    expect(writeConfig).toHaveBeenCalled();
  });

  it("handles existing config without force", async () => {
      fs.pathExists.mockResolvedValue(true);
      await expect(runInitCommand({ force: false })).rejects.toThrow(/already exists/);
  });

  it("handles force flag", async () => {
      fs.pathExists.mockResolvedValue(true);
      await runInitCommand({ force: true });
      expect(writeConfig).toHaveBeenCalled();
  });

  describe("init command edge cases", () => {
    it("detects project name from iOS scheme", async () => {
      detectIosSchemes.mockResolvedValueOnce({ default: "IosProject", options: ["IosProject"] });
      const result = await runInitCommand({ force: true });
      expect(result.projectName).toBe("IosProject");
    });

    it("detects project name from package.json and strips org prefix", async () => {
      fs.pathExists.mockImplementation(async (p: string) => {
        if (p.endsWith("package.json")) return true;
        return false;
      });
      fs.readJson.mockResolvedValueOnce({ name: "@my-company/cool-app" });

      const result = await runInitCommand({ force: true });
      expect(result.projectName).toBe("cool-app");
    });

    it("falls back when package.json reading fails", async () => {
      fs.pathExists.mockImplementation(async (p: string) => {
        if (p.endsWith("package.json")) return true;
        return false;
      });
      fs.readJson.mockRejectedValueOnce(new Error("invalid json"));

      const result = await runInitCommand({ force: true, cwd: "/path/to/my-custom-folder" });
      expect(result.projectName).toBe("my-custom-folder");
    });

    it("detects environments from dotenv", async () => {
      detectEnvironmentsFromDotEnv.mockResolvedValueOnce({
        staging: { envFile: ".env.staging", vars: { API: "staging" } }
      });
      const result = await runInitCommand({ force: true });
      expect(result.environments).toContain("staging");
    });

    it("falls back to root .env file for environment setup", async () => {
      fs.pathExists.mockImplementation(async (p: string) => {
        if (p.endsWith(".env")) return true;
        return false;
      });
      fs.readFile.mockResolvedValueOnce("API_URL=https://api.dev");

      const result = await runInitCommand({ force: true });
      expect(result.environments).toContain("development");
    });

    it("includes detected Android and iOS flavors in configuration", async () => {
      detectAndroidFlavors.mockResolvedValue({ options: ["free", "paid"], default: "free" });
      detectIosSchemes.mockResolvedValue({ options: ["scheme1", "scheme2"], default: "scheme1" });

      const result = await runInitCommand({ force: true });
      expect(result.platforms).toContain("android");
      expect(result.platforms).toContain("ios");
    });

    it("uses explicit project name when provided", async () => {
        const result = await runInitCommand({ force: true, projectName: "ExplicitName" });
        expect(result.projectName).toBe("ExplicitName");
    });

    it("detectProjectName fallbacks to directory name if package.json is invalid", async () => {
        fs.pathExists.mockImplementation(async (p: string) => {
            if (p.endsWith("ios")) return false;
            if (p.endsWith("package.json")) return true;
            return false;
        });
        fs.readJson.mockRejectedValueOnce(new Error("invalid json"));
        await runInitCommand({ force: true, cwd: "/my-app-folder" });
        expect(writeConfig).toHaveBeenCalledWith(expect.stringContaining("my-app-folder"), expect.objectContaining({ projectName: "my-app-folder" }));
    });

    it("detectProjectName fallbacks to default name if everything fails", async () => {
        fs.pathExists.mockResolvedValue(false);
        // For path.basename to return empty, cwd should be root "/"
        await runInitCommand({ force: true, cwd: "/" });
        expect(writeConfig).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ projectName: "my-rn-app" }));
    });
  });
});
