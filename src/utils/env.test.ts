import { parseDotEnv, interpolate } from "./env.js";

describe("env", () => {
  describe("parse", () => {
    it("parses pairs", () => {
      expect(parseDotEnv("K1=V1\nK2=V2")).toEqual({ K1: "V1", K2: "V2" });
    });

    it("handles spacing", () => {
      expect(parseDotEnv("  K1  =  V1  ")).toEqual({ K1: "V1" });
    });

    it("strips quotes", () => {
      expect(parseDotEnv('K1="V1"\nK2=\'V2\'')).toEqual({ K1: "V1", K2: "V2" });
    });

    it("skips non-data", () => {
      expect(parseDotEnv("# comm\n\nK1=V1\n  # comm")).toEqual({ K1: "V1" });
    });

    it("ignores bad lines", () => {
      expect(parseDotEnv("BAD\nK1=V1")).toEqual({ K1: "V1" });
    });
  });

  describe("interpolate", () => {
    it("replaces keys", () => {
      const vars = { P: "A", L: "B" };
      expect(interpolate("{{P}} {{L}}", vars)).toBe("A B");
    });

    it("handles missing", () => {
      expect(interpolate("H {{N}}", {})).toBe("H ");
    });

    it("handles multi", () => {
      expect(interpolate("{{A}} {{A}}", { A: "X" })).toBe("X X");
    });
  });
});
