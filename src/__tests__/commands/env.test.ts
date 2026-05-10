/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: jest.fn<any>(),
    readFile: jest.fn<any>(),
    writeFile: jest.fn<any>(),
    readdir: jest.fn<any>(),
    ensureDir: jest.fn<any>(),
    stat: jest.fn<any>()
  }
}));
jest.unstable_mockModule("../../utils/config.js", () => ({
  loadConfig: jest.fn<any>(),
  writeConfig: jest.fn<any>(),
  CONFIG_FILE: ".rnbuildrc.yml"
}));
jest.unstable_mockModule("@clack/prompts", () => ({
  confirm: jest.fn<any>(),
  intro: jest.fn<any>(),
  isCancel: jest.fn<any>().mockImplementation((v: any) => v === "__CANCEL__"),
  outro: jest.fn<any>(),
  select: jest.fn<any>(),
  text: jest.fn<any>(),
  spinner: jest.fn<any>(),
  note: jest.fn<any>()
}));

const { runEnvCommand } = await import("../../commands/env.js");
const { loadConfig, writeConfig } = await import("../../utils/config.js") as any;
const { confirm, isCancel, select, text } = await import("@clack/prompts") as any;
const fs = (await import("fs-extra")).default as any;

describe("env command", () => {
  const MOCK_CONFIG = () => ({
    projectName: "Test",
    defaultEnvironment: "dev",
    environments: {
      dev: { vars: { A: "1" }, envFile: ".env" },
      prod: { vars: { B: "2" } }
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    loadConfig.mockImplementation(() => Promise.resolve(MOCK_CONFIG()));
    isCancel.mockImplementation((v: any) => v === "__CANCEL__");
    fs.pathExists.mockResolvedValue(true);
    fs.readFile.mockResolvedValue("KEY=VAL");
    fs.ensureDir.mockResolvedValue(undefined);
    fs.readdir.mockResolvedValue([]);
    fs.stat.mockResolvedValue({ isDirectory: () => true });

    select.mockResolvedValue("__CANCEL__");
    confirm.mockResolvedValue(false);
    text.mockResolvedValue("__CANCEL__");
  });

  it("lists environments", async () => {
    await runEnvCommand("list");
  });

  it("views an environment", async () => {
      await runEnvCommand("view", "dev");
  });

  it("adds a new environment", async () => {
      text.mockResolvedValueOnce("newenv")
          .mockResolvedValueOnce(".env.new")
          .mockResolvedValueOnce("BASE_URL")
          .mockResolvedValueOnce("http://localhost");
      confirm.mockResolvedValueOnce(false);
      await runEnvCommand("add");
      expect(writeConfig).toHaveBeenCalled();
  });

  it("removes an environment", async () => {
      confirm.mockResolvedValueOnce(true);
      await runEnvCommand("remove", "prod");
      expect(writeConfig).toHaveBeenCalled();
  });

  it("detects environments", async () => {
      fs.readdir.mockResolvedValueOnce([
          { name: ".env.test", isFile: () => true, isDirectory: () => false } as any
      ]);
      confirm.mockResolvedValueOnce(true);
      await runEnvCommand("detect");
      expect(writeConfig).toHaveBeenCalled();
  });

  it("sets default environment", async () => {
      select.mockResolvedValueOnce("prod");
      await runEnvCommand("set-default");
      expect(writeConfig).toHaveBeenCalled();
  });
});
