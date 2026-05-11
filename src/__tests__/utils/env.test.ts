/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: jest.fn(),
    readFile: jest.fn()
  }
}));

const { parseDotEnv, interpolate, readDotEnv } = await import("../../utils/env.js");
const fs = (await import("fs-extra")).default as any;

describe("env utility", () => {
  it("parses dotenv content", () => {
    expect(parseDotEnv("K=V\n# C\n K2 = 'V2' \nB\nK3=\"V3\"\n=EMPTYKEY")).toEqual({ K: "V", K2: "V2", K3: "V3" });
  });

  it("interpolates strings", () => {
    expect(interpolate("{{A}} {{B}} {{C}} {{A}}", { A: "1", B: "2" })).toBe("1 2  1");
  });

  describe("readDotEnv", () => {
    it("returns empty object if file does not exist", async () => {
      fs.pathExists.mockResolvedValue(false);
      const res = await readDotEnv("missing.env");
      expect(res).toEqual({});
    });

    it("reads and parses env file if it exists", async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue("FOO=BAR");
      const res = await readDotEnv("exists.env");
      expect(res).toEqual({ FOO: "BAR" });
    });
  });
});
