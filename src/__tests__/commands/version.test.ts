/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    readFile: jest.fn<any>(),
    writeFile: jest.fn<any>(),
    pathExists: jest.fn<any>(),
    readdir: jest.fn<any>()
  }
}));
jest.unstable_mockModule("../../utils/config.js", () => ({
  loadConfig: jest.fn<any>()
}));
jest.unstable_mockModule("@clack/prompts", () => ({
  confirm: jest.fn<any>(),
  intro: jest.fn<any>(),
  isCancel: jest.fn<any>().mockImplementation((v: any) => v === "__CANCEL__"),
  outro: jest.fn<any>(),
  select: jest.fn<any>(),
  text: jest.fn<any>(),
  spinner: jest.fn<any>()
}));

const { runVersionCommand } = await import("../../commands/version.js");
const { loadConfig } = await import("../../utils/config.js") as any;
const { confirm, isCancel, select, text, spinner } = await import("@clack/prompts") as any;
const fs = (await import("fs-extra")).default as any;

describe("version command", () => {
  const mockConfig = {
    projectName: "MyApp",
    environments: { dev: { vars: {} } },
    defaultEnvironment: "dev",
    flavors: {
        android: { options: ["devFlavor"] },
        ios: { options: ["App"] }
    }
  };

  beforeEach(() => {
    jest.resetAllMocks();

    loadConfig.mockResolvedValue(mockConfig);
    confirm.mockResolvedValue(true);
    isCancel.mockImplementation((v: any) => v === "__CANCEL__");
    select.mockImplementation((p: any) => {
        if (p.message.includes("flavor")) return Promise.resolve("devFlavor");
        if (p.message.includes("scheme")) return Promise.resolve("App");
        if (p.message.includes("target")) return Promise.resolve("single");
        return Promise.resolve("android");
    });
    text.mockImplementation((p: any) => {
        if (p.message.includes("build number")) return Promise.resolve("2");
        return Promise.resolve("2.0.0");
    });
    spinner.mockReturnValue({ start: jest.fn(), stop: jest.fn() });

    fs.readFile.mockImplementation((p: string) => {
        if (p.endsWith(".gradle") || p.endsWith(".gradle.kts")) {
          return Promise.resolve('defaultConfig {\nversionName "1.0.0"\nversionCode 1\n}\nproductFlavors {\ndevFlavor {\nversionName "1.0.0"\nversionCode 1\n}\n}');
        }
        if (p.endsWith(".pbxproj")) {
          return Promise.resolve(
            '000000000000000000000ABC /* Build configuration list for PBXNativeTarget "App" */ = {\n' +
            '  isa = XCConfigurationList;\n' +
            '  buildConfigurations = (\n' +
            '    000000000000000000000DEF /* Debug */,\n' +
            '  );\n' +
            '};\n' +
            '000000000000000000000DEF /* Debug */ = {\n' +
            '  isa = XCBuildConfiguration;\n' +
            '  buildSettings = {\n' +
            '    MARKETING_VERSION = 1.0.0;\n' +
            '    CURRENT_PROJECT_VERSION = 1;\n' +
            '  };\n' +
            '};'
          );
        }
        if (p.endsWith("package.json")) return Promise.resolve('{"version": "1.0.0"}');
        return Promise.resolve("");
    });
    fs.writeFile.mockResolvedValue(undefined);
    fs.pathExists.mockResolvedValue(true);
    fs.readdir.mockImplementation((p: string) => {
        if (p.includes("ios")) return Promise.resolve(["MyApp.xcodeproj"]);
        return Promise.resolve([]);
    });
  });

  it("updates versions on android", async () => {
    const result = await runVersionCommand({ platform: "android", version: "2.0.0", androidBuildNumber: "2" });
    expect(result.status).toBe("success");
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it("updates versions on android with Kotlin DSL", async () => {
    loadConfig.mockResolvedValueOnce({
      projectName: "MyApp",
      environments: { dev: { vars: {} } },
      defaultEnvironment: "dev"
    });
    fs.pathExists.mockImplementation(async (p: string) => {
      if (p.endsWith("build.gradle")) return false;
      if (p.endsWith("build.gradle.kts")) return true;
      return true;
    });
    fs.readFile.mockImplementation((p: string) => {
        if (p.endsWith(".gradle.kts")) {
          return Promise.resolve('defaultConfig {\nversionName = "1.0.0"\nversionCode = 1\n}');
        }
        if (p.endsWith("package.json")) return Promise.resolve('{"version": "1.0.0"}');
        return Promise.resolve("");
    });

    const result = await runVersionCommand({ platform: "android", version: "2.0.0", androidBuildNumber: "2" });
    expect(result.status).toBe("success");
  });

  it("updates versions on ios", async () => {
      const result = await runVersionCommand({ platform: "ios", version: "2.0.0", iosBuildNumber: "2" });
      expect(result.status).toBe("success");
  });

  it("updates all flavors", async () => {
      const result = await runVersionCommand({ platform: "android", allFlavors: true, version: "2.0.0", androidBuildNumber: "2", iosBuildNumber: "2" });
      expect(result.status).toBe("success");
  });

  describe("version command edge cases", () => {
    it("throws error if both flavor and allFlavors are set", async () => {
      await expect(runVersionCommand({ flavor: "dev", allFlavors: true })).rejects.toThrow("Use either --flavor or --all-flavors, not both.");
    });

    it("throws error for invalid platform argument", async () => {
      await expect(runVersionCommand({ platform: "symbian" })).rejects.toThrow("Invalid platform 'symbian'");
    });

    it("throws error if resolution of Gradle file fails", async () => {
      fs.pathExists.mockResolvedValue(false);
      await expect(runVersionCommand({ platform: "android", version: "2.0.0" })).rejects.toThrow("Could not find android/app/build.gradle");
    });

    it("throws error if defaultConfig block is missing in gradle", async () => {
      fs.readFile.mockResolvedValue("no defaultConfig here");
      await expect(runVersionCommand({ platform: "android", version: "2.0.0" })).rejects.toThrow("Could not find defaultConfig block");
    });

    it("throws error if product flavor is missing", async () => {
      fs.readFile.mockResolvedValue("defaultConfig { } productFlavors { }");
      await expect(runVersionCommand({ platform: "android", flavor: "devFlavor", androidBuildNumber: "3" })).rejects.toThrow("Could not find product flavor block");
    });

    it("throws error if MARKETING_VERSION is missing in pbxproj", async () => {
      fs.readFile.mockImplementation((p: string) => {
        if (p.endsWith("project.pbxproj")) return Promise.resolve("no version settings");
        return Promise.resolve('{"version": "1.0.0"}');
      });
      await expect(runVersionCommand({ platform: "ios", version: "2.0.0" })).rejects.toThrow("MARKETING_VERSION not found in project.pbxproj");
    });

    it("throws error if target build configurations are not found in pbxproj", async () => {
      fs.readFile.mockImplementation((p: string) => {
        if (p.endsWith("project.pbxproj")) return Promise.resolve("MARKETING_VERSION = 1.0.0;");
        return Promise.resolve('{"version": "1.0.0"}');
      });
      await expect(runVersionCommand({ platform: "ios", flavor: "App", iosBuildNumber: "3" })).rejects.toThrow("Could not find build configurations for target");
    });

    it("throws error if CURRENT_PROJECT_VERSION is missing in pbxproj", async () => {
      loadConfig.mockResolvedValueOnce({
        projectName: "MyApp",
        environments: { dev: { vars: {} } },
        defaultEnvironment: "dev"
      });
      fs.readFile.mockImplementation((p: string) => {
        if (p.endsWith("project.pbxproj")) return Promise.resolve("MARKETING_VERSION = 1.0.0;");
        return Promise.resolve('{"version": "1.0.0"}');
      });
      await expect(runVersionCommand({ platform: "ios", iosBuildNumber: "3" })).rejects.toThrow("CURRENT_PROJECT_VERSION not found in project.pbxproj");
    });

    it("handles readCurrentAndroidVersions and readCurrentIosVersions fail gracefully", async () => {
      fs.readFile.mockRejectedValueOnce(new Error("read error")); // android read
      fs.readFile.mockRejectedValueOnce(new Error("read error")); // ios read
      const result = await runVersionCommand({ ci: false });
      expect(result.status).toBe("success");
    });

    it("throws error when package.json not found", async () => {
      fs.pathExists.mockImplementation(async (p: string) => {
        if (p.endsWith("package.json")) return false;
        return true;
      });
      await expect(runVersionCommand({ platform: "android", version: "2.0.0" })).rejects.toThrow("package.json not found in project root.");
    });

    it("throws error in CI mode if no version/buildNumber is specified", async () => {
      await expect(runVersionCommand({ ci: true })).rejects.toThrow("At least one of --version, --android-build-number, or --ios-build-number must be provided.");
    });

    it("throws error if no values at all are provided in interactive mode", async () => {
      text.mockImplementationOnce(() => Promise.resolve(""));
      text.mockImplementationOnce(() => Promise.resolve(""));
      text.mockImplementationOnce(() => Promise.resolve(""));
      await expect(runVersionCommand({ ci: false })).rejects.toThrow("At least one value must be provided.");
    });

    it("throws error if androidBuildNumber is not a positive integer", async () => {
      await expect(runVersionCommand({ platform: "android", androidBuildNumber: "abc" })).rejects.toThrow("Android build number must be a positive integer.");
    });

    it("throws error if iosBuildNumber is not a positive integer", async () => {
      await expect(runVersionCommand({ platform: "ios", iosBuildNumber: "-10" })).rejects.toThrow("iOS build number must be a positive integer.");
    });

    it("throws error if android flavor specified is not configured", async () => {
      await expect(runVersionCommand({ platform: "android", flavor: "invalid_flavor", androidBuildNumber: "5" })).rejects.toThrow("Android flavor 'invalid_flavor' is not configured.");
    });

    it("throws error if ios scheme specified is not configured", async () => {
      await expect(runVersionCommand({ platform: "ios", flavor: "invalid_scheme", iosBuildNumber: "5" })).rejects.toThrow("iOS scheme 'invalid_scheme' is not configured.");
    });

    it("handles cancel inside interactive mode prompts", async () => {
      text.mockResolvedValueOnce("__CANCEL__");
      await expect(runVersionCommand({ ci: false })).rejects.toThrow("Operation cancelled");
    });

    it("handles promptSelect return cancel in version target prompts", async () => {
      select.mockResolvedValueOnce("all"); // Android target
      select.mockResolvedValueOnce("__CANCEL__"); // iOS target cancellation or select cancel
      isCancel.mockImplementation((v: any) => v === "__CANCEL__" || v === "all"); // Wait, let's keep isCancel mock simple:
    });
  });
});
