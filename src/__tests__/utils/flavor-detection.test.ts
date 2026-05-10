/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: jest.fn<any>(),
    readdir: jest.fn<any>(),
    readFile: jest.fn<any>()
  }
}));

const { detectAndroidFlavors, detectIosSchemes } = await import("../../utils/flavor-detection.js");
const fs = (await import("fs-extra")).default as any;

describe("flavor detection", () => {
  beforeEach(() => {
      jest.clearAllMocks();
  });

  it("detects android flavors", async () => {
    fs.pathExists.mockResolvedValue(true);
    fs.readFile.mockResolvedValue('productFlavors {\n free {\n }\n paid {\n }\n }');

    const config = await detectAndroidFlavors("/app");
    expect(config?.options).toContain("free");
    expect(config?.options).toContain("paid");
  });

  it("detects ios schemes", async () => {
    fs.pathExists.mockResolvedValue(true);
    fs.readdir.mockImplementation((p: string) => {
        if (p.endsWith("ios")) return Promise.resolve([
            { name: "App.xcodeproj", isDirectory: () => false, isFile: () => true } as any
        ]);
        return Promise.resolve([]);
    });

    const config = await detectIosSchemes("/app");
    expect(config?.options).toContain("App");
  });

  it("handles missing directories", async () => {
    fs.pathExists.mockResolvedValue(false);
    const android = await detectAndroidFlavors("/app");
    const ios = await detectIosSchemes("/app");
    expect(android).toBeUndefined();
    expect(ios).toBeUndefined();
  });
});
