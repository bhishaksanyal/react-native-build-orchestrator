import { parseConfig } from "./schema.js";

describe("schema validation", () => {
  const minimalValidConfig = {
    projectName: "TestApp",
    defaultEnvironment: "production",
    environments: {
      production: {
        vars: { BASE_URL: "https://api.com" },
      },
    },
    fastlane: {},
    builds: {
      development: {},
      adhoc: {},
      store: {
        android: {
          enabled: true,
          command: "gradlew bundleRelease",
        },
      },
    },
  };

  it("should validate a correct config", () => {
    expect(() => parseConfig(minimalValidConfig)).not.toThrow();
  });

  it("should throw if defaultEnvironment is missing from environments", () => {
    const invalidConfig = {
      ...minimalValidConfig,
      defaultEnvironment: "staging",
    };
    expect(() => parseConfig(invalidConfig)).toThrow(/defaultEnvironment must match/);
  });

  it("should throw if projectName is empty", () => {
    const invalidConfig = {
      ...minimalValidConfig,
      projectName: "",
    };
    expect(() => parseConfig(invalidConfig)).toThrow();
  });

  it("should validate flavor configurations", () => {
    const configWithFlavors = {
      ...minimalValidConfig,
      flavors: {
        android: {
          default: "clientA",
          options: ["clientA", "clientB"],
          commandMap: {
            clientA: "ClientA",
          },
        },
      },
    };
    expect(() => parseConfig(configWithFlavors)).not.toThrow();
  });

  it("should throw if flavor default is not in options", () => {
    const invalidConfig = {
      ...minimalValidConfig,
      flavors: {
        android: {
          default: "unknown",
          options: ["clientA"],
        },
      },
    };
    expect(() => parseConfig(invalidConfig)).toThrow(/default android flavor must match/);
  });

  it("should throw if flavor commandMap has unknown keys", () => {
    const invalidConfig = {
      ...minimalValidConfig,
      flavors: {
        android: {
          options: ["clientA"],
          commandMap: {
            unknown: "Something",
          },
        },
      },
    };
    expect(() => parseConfig(invalidConfig)).toThrow(/mapped android flavor must exist in options/);
  });
});
