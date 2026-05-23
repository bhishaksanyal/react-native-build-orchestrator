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

const normalizePath = (p: string) => p.replace(/\\/g, "/");

type DirEntry = { name: string; isDirectory?: boolean; isFile?: boolean };

function mockReaddir(structure: Record<string, DirEntry[]>) {
    (fs.readdir as any).mockImplementation((p: string, options: any) => {
        const normalizedPath = normalizePath(p);
        const matchingKey = Object.keys(structure).find(k => normalizedPath.endsWith(k));
        if (!matchingKey) return Promise.resolve([]);
        const entries = structure[matchingKey].map(e => ({
            name: e.name,
            isDirectory: () => e.isDirectory ?? !e.isFile,
            isFile: () => e.isFile ?? !e.isDirectory,
            isSymlink: () => false
        }));
        return Promise.resolve(options?.withFileTypes ? entries : entries.map(e => e.name));
    });
}

function mockPathExists(rules: Record<string, boolean>) {
    (fs.pathExists as any).mockImplementation((p: string) => {
        const normalizedPath = normalizePath(p);
        const match = Object.keys(rules).find(k => normalizedPath.includes(k) || normalizedPath.endsWith(k));
        if (match) return Promise.resolve(rules[match]);
        return Promise.resolve(true);
    });
}

function mockReadFile(rules: Record<string, string>) {
    (fs.readFile as any).mockImplementation((p: string) => {
        const normalizedPath = normalizePath(p);
        const match = Object.keys(rules).find(k => normalizedPath.endsWith(k));
        if (match) return Promise.resolve(rules[match]);
        return Promise.resolve("// some content");
    });
}

describe("runtime exports utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
    expect(vars.NODE_ENV).toBe("production");
  });

  it("createRuntimeVars defaults buildType to development", () => {
    const vars = createRuntimeVars({
      envName: "dev",
      envFileVars: {},
      envConfigVars: {}
    });
    expect(vars.NODE_ENV).toBe("development");
  });

  it("createRuntimeVars handles empty normalized keys", () => {
    const vars = createRuntimeVars({
      envName: "dev",
      buildType: "development",
      envFileVars: {},
      envConfigVars: { "!@#": "val1", "$%^": "val2" }
    });
    expect(vars["!@#"]).toBe("val1");
    expect(vars["$%^"]).toBe("val2");
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
        mockPathExists({ android: false, "/ios": true });
        mockReaddir({
            "/ios": [
                { name: "App", isDirectory: true },
                { name: "Pods", isDirectory: true }
            ],
            "/ios/App": [
                { name: "Info.plist", isFile: true }
            ]
        });
        mockReadFile({ "Info.plist": "<dict>\n</dict>" });

        const res = await writeRuntimeEnvExports("/app", "prod", { KEY: "VAL" });
        expect(res.iosInfoPlistPaths).toContain(path.join("/app", "ios", "App", "Info.plist"));
    });

    it("handles keys that normalize to empty string for android/ios resources", async () => {
        mockPathExists({ "/ios/App": true, "/ios": true });
        mockReaddir({
            "/ios": [
                { name: "NoPlistFile", isFile: true }
            ],
            "/ios/NoPlistFile": []
        });
        (fs.readFile as any).mockResolvedValue("some content");

        const res = await writeRuntimeEnvExports("/app", "prod", { "!@#$": "val1", normal_key: "val2" });
        expect(res.runtimeEnvFilePath).toBeDefined();
        expect(fs.writeFile).toHaveBeenCalled();
    });

    it("handles keys that normalize to empty string in Info.plist", async () => {
        mockPathExists({});
        mockReaddir({
            "/ios": [
                { name: "App", isDirectory: true }
            ],
            "/ios/App": [
                { name: "Info.plist", isFile: true }
            ]
        });
        mockReadFile({ "Info.plist": "<dict></dict>" });

        const res = await writeRuntimeEnvExports("/app", "prod", { "!@#": "val1" });
        expect(fs.writeFile).toHaveBeenCalled();
        expect(res.iosInfoPlistPaths).toContain(path.join("/app", "ios", "App", "Info.plist"));
    });

    it("handles Info.plist without closing dict tag", async () => {
        mockPathExists({ android: false, "/ios": true });
        mockReaddir({
            "/ios": [
                { name: "App", isDirectory: true }
            ],
            "/ios/App": [
                { name: "Info.plist", isFile: true }
            ]
        });
        mockReadFile({ "Info.plist": "<dict>" });

        const res = await writeRuntimeEnvExports("/app", "prod", { KEY: "VAL" });
        expect(res.iosInfoPlistPaths).toHaveLength(0);
    });

  });
});
