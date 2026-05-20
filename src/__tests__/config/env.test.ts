import { RNBuildEnv } from "../../config/env.js";
import DefaultConfig from "../../config/env.js";

describe("config/env", () => {
  it("exports RNBuildEnv", () => {
    expect(RNBuildEnv).toBeDefined();
    expect(RNBuildEnv.NODE_ENV).toBeDefined();
  });

  it("has a default export", () => {
    expect(DefaultConfig).toBe(RNBuildEnv);
  });
});
