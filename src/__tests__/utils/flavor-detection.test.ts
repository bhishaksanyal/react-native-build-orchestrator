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

  it("extractNamedBlock handles edge cases", async () => {
    fs.pathExists.mockImplementation(async (p: string) => p.includes("build.gradle"));
    // All candidates should return something that fails
    fs.readFile.mockResolvedValue('nothing here');
    expect(await detectAndroidFlavors("/app")).toBeUndefined();

    // Missing brace
    fs.readFile.mockResolvedValue('productFlavors no brace');
    expect(await detectAndroidFlavors("/app")).toBeUndefined();

    // Unbalanced braces
    fs.readFile.mockResolvedValue('productFlavors { missing closing');
    expect(await detectAndroidFlavors("/app")).toBeUndefined();
  });

  it("detects android flavors with Kotlin DSL (create syntax)", async () => {
    fs.pathExists.mockResolvedValue(true);
    fs.readFile.mockResolvedValue('productFlavors {\n create("free") {\n }\n create("paid") {\n }\n }');

    const config = await detectAndroidFlavors("/app");
    expect(config?.options).toContain("free");
    expect(config?.options).toContain("paid");
  });

  it("detects ios schemes from .xcscheme files", async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockImplementation((p: string) => {
          if (p.endsWith("ios")) {
              return Promise.resolve([
                  { name: "MyScheme.xcscheme", isDirectory: () => false, isFile: () => true } as any
              ]);
          }
          return Promise.resolve([]);
      });

      const config = await detectIosSchemes("/app");
      expect(config?.options).toContain("MyScheme");
  });

  it("ios detection skips Pods and build directories", async () => {
      fs.pathExists.mockResolvedValue(true);
      let podsVisited = false;
      fs.readdir.mockImplementation((p: string) => {
          if (p.endsWith("ios")) {
              return Promise.resolve([
                  { name: "Pods", isDirectory: () => true } as any,
                  { name: "App.xcodeproj", isDirectory: () => false } as any
              ]);
          }
          if (p.includes("Pods")) {
              podsVisited = true;
          }
          return Promise.resolve([]);
      });

      await detectIosSchemes("/app");
      expect(podsVisited).toBe(false);
  });

  it("detects android flavors from build.gradle.kts", async () => {
    fs.pathExists.mockImplementation(async (p: string) => p.endsWith(".kts"));
    fs.readFile.mockResolvedValue('productFlavors {\n create("kotlinFlavor") { }\n }');

    const config = await detectAndroidFlavors("/app");
    expect(config?.options).toContain("kotlinFlavor");
  });

  it("handles empty product flavors block", async () => {
    fs.pathExists.mockResolvedValue(true);
    fs.readFile.mockResolvedValue('productFlavors {\n }');

    const config = await detectAndroidFlavors("/app");
    expect(config).toBeUndefined();
  });

  it("ios detection falls back to project names if no schemes found", async () => {
      fs.pathExists.mockImplementation(async (p: string) => {
          if (p.endsWith("ios")) return true;
          return false;
      });
      fs.readdir.mockImplementation((p: string) => {
          if (p.endsWith("ios")) {
              // Report as FILE to avoid recursion and trigger predicate match
              return Promise.resolve([
                  { name: "MyProj.xcodeproj", isDirectory: () => false, isFile: () => true } as any
              ]);
          }
          return Promise.resolve([]);
      });

      const config = await detectIosSchemes("/app");
      expect(config?.options).toContain("MyProj");
      expect(config?.default).toBe("MyProj");
  });

  it("ios detection recurses into subdirectories", async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockImplementation((p: string) => {
          if (p.endsWith("ios")) {
              return Promise.resolve([
                  { name: "SubDir", isDirectory: () => true } as any
              ]);
          }
          if (p.endsWith("SubDir")) {
              return Promise.resolve([
                  { name: "Nested.xcscheme", isDirectory: () => false } as any
              ]);
          }
          return Promise.resolve([]);
      });

      const config = await detectIosSchemes("/app");
      expect(config?.options).toContain("Nested");
  });

  it("returns undefined if no projects found in fallback", async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockResolvedValue([]); // No files at all
      const config = await detectIosSchemes("/app");
      expect(config).toBeUndefined();
  });

  it("collectFiles handles non-existent subdirectory", async () => {
      fs.pathExists.mockImplementation(async (p: string) => {
          if (p.endsWith("ios")) return true;
          if (p.includes("MissingDir")) return false;
          return true;
      });
      fs.readdir.mockImplementation((p: string) => {
          if (p.endsWith("ios")) {
              return Promise.resolve([
                  { name: "MissingDir", isDirectory: () => true } as any,
                  { name: "ExistingDir", isDirectory: () => true } as any
              ]);
          }
          if (p.endsWith("ExistingDir")) {
              return Promise.resolve([
                  { name: "Scheme.xcscheme", isDirectory: () => false } as any
              ]);
          }
          return Promise.resolve([]);
      });

      const config = await detectIosSchemes("/app");
      expect(config?.options).toContain("Scheme");
  });
});
