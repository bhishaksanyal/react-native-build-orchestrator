/* eslint-disable @typescript-eslint/no-explicit-any */
import path from "node:path";
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: jest.fn<any>(),
    ensureDir: jest.fn<any>(),
    writeFile: jest.fn<any>(),
    readdir: jest.fn<any>(),
    stat: jest.fn<any>(),
    readFile: jest.fn<any>()
  }
}));

const { createRuntimeVars, writeRuntimeEnvExports } = await import("../../utils/runtime-exports.js");
const fs = (await import("fs-extra")).default as any;

describe("runtime exports utility", () => {
  it("creates runtime variables from various sources", () => {
    const vars = createRuntimeVars({
      envName: "prod",
      buildType: "store",
      platform: "android",
      flavor: "paid",
      envFileVars: { FILE_KEY: "file_val" },
      envConfigVars: { CONFIG_KEY: "config_val" }
    });
    expect(vars.FILE_KEY).toBe("file_val");
    expect(vars.CONFIG_KEY).toBe("config_val");
    expect(vars.RNBUILD_ENV_NAME).toBe("prod");
  });

  describe("writeRuntimeEnvExports", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fs.pathExists as any).mockImplementation((p: string) => {
            if (p.includes("android")) return Promise.resolve(false);
            return Promise.resolve(true);
        });
        (fs.ensureDir as any).mockResolvedValue(undefined);
        (fs.writeFile as any).mockResolvedValue(undefined);
        (fs.readdir as any).mockResolvedValue([]);
        (fs.stat as any).mockResolvedValue({ isDirectory: () => true });
        (fs.readFile as any).mockResolvedValue("<dict></dict>");
    });

    it("writes TS, wrapper and .env files", async () => {
      const res = await writeRuntimeEnvExports("/app", "prod", { KEY: "VAL" });
      expect(fs.writeFile).toHaveBeenCalledTimes(3);
      expect(res.runtimeEnvFilePath).toContain(".rnbuild/active.env");
    });

    it("updates ios Info.plist if they exist", async () => {
        (fs.pathExists as any).mockImplementation((p: string) => {
            const normalizedPath = p.replace(/\\/g, "/");
            if (normalizedPath.includes("android")) return Promise.resolve(false);
            if (normalizedPath.endsWith("ios")) return Promise.resolve(true);
            return Promise.resolve(true);
        });

        (fs.readdir as any).mockImplementation((p: string, options: any) => {
            const normalizedPath = p.replace(/\\/g, "/");
            if (normalizedPath.endsWith("/ios")) {
                const entries = [
                    { name: "App", isDirectory: () => true, isFile: () => false, isSymlink: () => false },
                    { name: "Pods", isDirectory: () => true, isFile: () => false, isSymlink: () => false }
                ] as any;
                return Promise.resolve(options?.withFileTypes ? entries : ["App", "Pods"]);
            }
            if (normalizedPath.endsWith("/ios/App")) {
                const entries = [
                    { name: "Info.plist", isDirectory: () => false, isFile: () => true, isSymlink: () => false }
                ] as any;
                return Promise.resolve(options?.withFileTypes ? entries : ["Info.plist"]);
            }
            return Promise.resolve([]);
        });

        (fs.readFile as any).mockImplementation((p: string) => {
            const normalizedPath = p.replace(/\\/g, "/");
            if (normalizedPath.endsWith("Info.plist")) return Promise.resolve("<dict>\n</dict>");
            return Promise.resolve("// some content");
        });

        const res = await writeRuntimeEnvExports("/app", "prod", { KEY: "VAL" });
        expect(res.iosInfoPlistPaths).toContain(path.join("/app", "ios", "App", "Info.plist"));
    });
  });
});
