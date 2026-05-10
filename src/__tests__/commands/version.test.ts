/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    readFile: (p: string) => {
        if (p.endsWith(".gradle")) return Promise.resolve('defaultConfig {\nversionName "1.0.0"\nversionCode 1\n}\nproductFlavors {\ndevFlavor {\nversionName "1.0.0"\nversionCode 1\n}\n}');
        if (p.endsWith(".pbxproj")) return Promise.resolve(
            'App = { buildConfigurationList = ABC; };\n' +
            'ABC = { buildConfigurations = ( DEF ); };\n' +
            'DEF = { buildSettings = { MARKETING_VERSION = 1.0.0; CURRENT_PROJECT_VERSION = 1; }; };'
        );
        if (p.endsWith("package.json")) return Promise.resolve('{"version": "1.0.0"}');
        return Promise.resolve("");
    },
    writeFile: () => Promise.resolve(),
    pathExists: () => Promise.resolve(true),
    readdir: (p: string) => {
        if (p.includes("ios")) return Promise.resolve(["MyApp.xcodeproj"]);
        return Promise.resolve([]);
    }
  }
}));
jest.unstable_mockModule("../../utils/config.js", () => ({
  loadConfig: () => Promise.resolve({
    projectName: "MyApp",
    environments: { dev: { vars: {} } },
    flavors: {
        android: { options: ["devFlavor"] },
        ios: { options: ["App"] }
    }
  })
}));
jest.unstable_mockModule("@clack/prompts", () => ({
  confirm: () => Promise.resolve(true),
  intro: () => {},
  isCancel: (v: any) => v === "__CANCEL__",
  outro: () => {},
  select: (p: any) => {
      if (p.message.includes("flavor")) return Promise.resolve("devFlavor");
      if (p.message.includes("scheme")) return Promise.resolve("App");
      return Promise.resolve("android");
  },
  text: (p: any) => {
      if (p.message.includes("build number")) return Promise.resolve("2");
      return Promise.resolve("2.0.0");
  },
  spinner: () => ({ start: () => {}, stop: () => {} })
}));

const { runVersionCommand } = await import("../../commands/version.js");

describe("version command", () => {
  it("updates versions on android", async () => {
    await runVersionCommand({ platform: "android", version: "2.0.0", androidBuildNumber: "2" });
  });

  it("updates versions on ios", async () => {
      await runVersionCommand({ platform: "ios", version: "2.0.0", iosBuildNumber: "2" });
  });

  it("updates all flavors", async () => {
      await runVersionCommand({ platform: "android", allFlavors: true, version: "2.0.0", androidBuildNumber: "2", iosBuildNumber: "2" });
  });
});
