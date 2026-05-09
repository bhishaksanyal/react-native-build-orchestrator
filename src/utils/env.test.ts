import { parseDotEnv, interpolate } from "./env.js";

describe("env", () => {
  it("parses", () => {
    expect(parseDotEnv("K=V\n# C\n K2 = 'V2' \nB\nK3=\"V3\"")).toEqual({ K: "V", K2: "V2", K3: "V3" });
  });

  it("interpolates", () => {
    expect(interpolate("{{A}} {{B}} {{C}} {{A}}", { A: "1", B: "2" })).toBe("1 2  1");
  });
});
