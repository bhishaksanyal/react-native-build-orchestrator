/* eslint-disable @typescript-eslint/no-explicit-any */
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
    expect(vars.RN_BUILD_ENV_NAME).toBe("prod");
  });

  describe("writeRuntimeEnvExports", () => {
    beforeEach(() => {
        (fs.pathExists as any).mockResolvedValue(true);
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
        (fs.readdir as any).mockResolvedValueOnce([
            { name: "App", isDirectory: () => true, isFile: () => false },
            { name: "Pods", isDirectory: () => true, isFile: () => false }
        ] as any);
        (fs.readdir as any).mockImplementation((p: string) => {
            if (p.includes("App")) return Promise.resolve([
                { name: "Info.plist", isDirectory: () => false, isFile: () => true } as any
            ]);
            return Promise.resolve([]);
        });
        await writeRuntimeEnvExports("/app", "prod", { KEY: "VAL" });
        expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining("Info.plist"), expect.any(String));
    });
  });
});
