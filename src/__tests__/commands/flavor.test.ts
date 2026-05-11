/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: () => Promise.resolve(true),
    readdir: () => Promise.resolve([]),
    ensureDir: () => Promise.resolve(),
    writeFile: () => Promise.resolve(),
    stat: () => Promise.resolve({ isDirectory: () => true }),
    readFile: () => Promise.resolve("<dict></dict>")
  }
}));
jest.unstable_mockModule("../../utils/config.js", () => ({
  loadConfig: () => Promise.resolve({
    projectName: "Test",
    flavors: {
      android: { options: ["dev", "prod"], default: "dev", commandMap: { prod: "ProdFlavor" } },
      ios: { options: ["App"], default: "App" }
    }
  }),
  writeConfig: () => Promise.resolve(".rnbuildrc.yml"),
  CONFIG_FILE: ".rnbuildrc.yml"
}));

jest.unstable_mockModule("@clack/prompts", () => ({
  confirm: () => Promise.resolve(false),
  intro: () => {},
  isCancel: (v: any) => v === "__CANCEL__",
  outro: () => {},
  select: () => Promise.resolve("__CANCEL__"),
  text: () => Promise.resolve("__CANCEL__"),
  spinner: () => ({ start: () => {}, stop: () => {} }),
  note: () => {}
}));

const { runFlavorCommand } = await import("../../commands/flavor.js");

describe("flavor command", () => {
  it("lists flavors and cancels", async () => {
    await runFlavorCommand("list");
  });
});
