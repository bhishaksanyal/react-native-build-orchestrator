import { parseConfig } from "../schema.js";

describe("schema validation", () => {
  const validBaseConfig = {
    projectName: "Test",
    defaultEnvironment: "dev",
    environments: { dev: {} },
    builds: {
      development: { android: { enabled: true, command: "test" } },
      adhoc: {},
      store: {}
    }
  };

  it("passes for valid config", () => {
    expect(() => parseConfig(validBaseConfig)).not.toThrow();
  });

  it("fails when defaultEnvironment is missing from environments", () => {
    const config = { ...validBaseConfig, defaultEnvironment: "prod" };
    expect(() => parseConfig(config)).toThrow("defaultEnvironment must match a configured environment name");
  });

  it("fails when default flavor is not in options", () => {
    const config = {
      ...validBaseConfig,
      flavors: {
        android: { options: ["free"], default: "paid" }
      }
    };
    expect(() => parseConfig(config)).toThrow("default android flavor must match one of the configured options");
  });

  it("fails when commandMap key is not in options", () => {
    const config = {
      ...validBaseConfig,
      flavors: {
        android: { options: ["free"], commandMap: { paid: "PaidFlavor" } }
      }
    };
    expect(() => parseConfig(config)).toThrow("mapped android flavor must exist in options");
  });

  it("passes with valid commandMap mapping existing flavor", () => {
    const config = {
      ...validBaseConfig,
      flavors: {
        android: { options: ["free"], commandMap: { free: "FreeFlavor" } }
      }
    };
    expect(() => parseConfig(config)).not.toThrow();
  });

  it("fails when default flavor is missing for ios", () => {
    const invalid = {
      projectName: "Test",
      defaultEnvironment: "dev",
      environments: { dev: {} },
      flavors: {
          ios: { options: ["App"], default: "Missing" }
      },
      builds: {
          development: {},
          adhoc: {},
          store: {}
      }
    };
    expect(() => parseConfig(invalid)).toThrow("default ios flavor must match one of the configured options");
  });
});
