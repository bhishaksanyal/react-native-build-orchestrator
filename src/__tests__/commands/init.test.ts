/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: jest.fn<any>(),
    writeFile: jest.fn<any>(),
    readdir: jest.fn<any>(),
    readFile: jest.fn<any>(),
    ensureDir: jest.fn<any>(),
    stat: jest.fn<any>()
  }
}));
jest.unstable_mockModule("../../utils/config.js", () => ({
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

const { runInitCommand } = await import("../../commands/init.js");
const { writeConfig } = await import("../../utils/config.js") as any;
const { confirm, text, spinner } = await import("@clack/prompts") as any;
const fs = (await import("fs-extra")).default as any;

describe("init command", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.pathExists.mockResolvedValue(false);
    fs.readdir.mockResolvedValue([]);
    fs.readFile.mockResolvedValue("KEY=VAL");
    fs.ensureDir.mockResolvedValue(undefined);
    fs.stat.mockResolvedValue({ isDirectory: () => true });
    text.mockResolvedValue("MyApp");
    confirm.mockResolvedValue(true);
    spinner.mockReturnValue({ start: jest.fn(), stop: jest.fn() });
  });

  it("initializes a new project", async () => {
    await runInitCommand({ force: false });
    expect(writeConfig).toHaveBeenCalled();
  });

  it("handles existing config without force", async () => {
      fs.pathExists.mockResolvedValue(true);
      await expect(runInitCommand({ force: false })).rejects.toThrow(/already exists/);
  });

  it("handles force flag", async () => {
      fs.pathExists.mockResolvedValue(true);
      await runInitCommand({ force: true });
      expect(writeConfig).toHaveBeenCalled();
  });
});
