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
    jest.resetAllMocks();
    loadConfig.mockImplementation(() => Promise.resolve(MOCK_CONFIG()));
    writeConfig.mockResolvedValue("path");
    isCancel.mockImplementation((v: any) => v === "__CANCEL__" || (typeof v === "symbol" && (v.description === "clack:cancel" || v.description === "cancel")));
    fs.pathExists.mockResolvedValue(true);
    fs.readFile.mockResolvedValue("KEY=VAL");
    fs.ensureDir.mockResolvedValue(undefined);
    fs.readdir.mockResolvedValue([]);
    fs.stat.mockResolvedValue({ isDirectory: () => true });

    select.mockImplementation((options: any) => Promise.resolve(options.initialValue || options.options[0].value));
    confirm.mockResolvedValue(true);
    text.mockImplementation((options: any) => Promise.resolve(options.defaultValue || ""));
  });

  it("lists environments", async () => {
    const res = await runEnvCommand("list");
    expect(res.status).toBe("success");
    expect(writeConfig).not.toHaveBeenCalled();
  });

  it("views an environment", async () => {
      const res = await runEnvCommand("view", "dev");
      expect(res.status).toBe("success");
      expect(writeConfig).not.toHaveBeenCalled();
  });

  it("adds a new environment", async () => {
      text.mockResolvedValueOnce("newenv")
          .mockResolvedValueOnce(".env.new")
          .mockResolvedValueOnce("BASE_URL")
          .mockResolvedValueOnce("http://localhost");
      confirm.mockResolvedValueOnce(true) // Link env file
             .mockResolvedValueOnce(true) // Add or update var
             .mockResolvedValueOnce(false); // Add another var
      const res = await runEnvCommand("add");
      expect(res.status).toBe("success");
      expect(writeConfig).toHaveBeenCalled();
  });

  it("removes an environment", async () => {
      confirm.mockResolvedValueOnce(true);
      const res = await runEnvCommand("remove", "prod");
      expect(res.status).toBe("success");
      expect(writeConfig).toHaveBeenCalled();
  });

  it("detects environments", async () => {
      fs.readdir.mockResolvedValueOnce([
          { name: ".env.test", isFile: () => true, isDirectory: () => false } as any
      ]);
      confirm.mockResolvedValueOnce(true);
      const res = await runEnvCommand("detect");
      expect(res.status).toBe("success");
      expect(writeConfig).toHaveBeenCalled();
  });

  it("sets default environment", async () => {
      select.mockResolvedValueOnce("prod");
      const res = await runEnvCommand("set-default");
      expect(res.status).toBe("success");
      expect(writeConfig).toHaveBeenCalled();
  });

  describe("env command edge cases", () => {
    it("handles loadConfigForEnvCommand fallback when file exists but config lacks builds", async () => {
      loadConfig.mockRejectedValueOnce(new Error("load failed"));
      fs.pathExists.mockResolvedValueOnce(true);
      fs.readFile.mockResolvedValueOnce("projectName: Test"); // no builds

      await expect(runEnvCommand("list")).rejects.toThrow("load failed");
    });

    it("handles loadConfigForEnvCommand fallback when file exists and contains builds", async () => {
      loadConfig.mockRejectedValueOnce(new Error("load failed"));
      fs.pathExists.mockResolvedValueOnce(true);
      fs.readFile.mockResolvedValueOnce("projectName: Test\nbuilds:\n  store:\n    android:\n      enabled: true");

      const res = await runEnvCommand("list");
      expect(res.status).toBe("success");
    });

    it("handles view environment when no environments are configured", async () => {
      loadConfig.mockResolvedValueOnce({
        projectName: "Test",
        defaultEnvironment: "",
        environments: {}
      } as any);
      const res = await runEnvCommand("view");
      expect(res.status).toBe("success");
    });

    it("handles view environment when it does not exist", async () => {
      await expect(runEnvCommand("view", "missing")).rejects.toThrow("does not exist");
    });

    it("handles view environment with unreadable env file and empty variables", async () => {
      const configWithFile = MOCK_CONFIG();
      configWithFile.environments.dev.envFile = ".env.unreadable";
      delete (configWithFile.environments.dev as any).vars;
      loadConfig.mockResolvedValueOnce(configWithFile);

      fs.readFile.mockRejectedValueOnce(new Error("read failed"));
      const res = await runEnvCommand("view", "dev");
      expect(res.status).toBe("success");
    });

    it("handles view environment with empty env file variables", async () => {
      const configWithFile = MOCK_CONFIG();
      configWithFile.environments.dev.envFile = ".env.empty";
      loadConfig.mockResolvedValueOnce(configWithFile);

      fs.readFile.mockResolvedValueOnce("");
      const res = await runEnvCommand("view", "dev");
      expect(res.status).toBe("success");
    });

    it("handles add environment name errors and missing defaults", async () => {
      // empty name
      text.mockResolvedValueOnce("");
      await expect(runEnvCommand("add")).rejects.toThrow("Name cannot be empty");

      // name exists
      text.mockResolvedValueOnce("dev");
      await expect(runEnvCommand("add")).rejects.toThrow("already exists");

      // collectVars empty key
      text.mockResolvedValueOnce("newenv")
          .mockResolvedValueOnce(".env.newenv")
          .mockResolvedValueOnce(""); // empty key
      confirm.mockResolvedValueOnce(true) // Link env file
             .mockResolvedValueOnce(true); // Add variable
      await expect(runEnvCommand("add")).rejects.toThrow("Variable key cannot be empty");
    });

    it("handles edit environment when no environments exist", async () => {
      loadConfig.mockResolvedValueOnce({
        projectName: "Test",
        defaultEnvironment: "",
        environments: {}
      } as any);
      const res = await runEnvCommand("edit");
      expect(res.status).toBe("success");
    });

    it("handles edit environment that does not exist", async () => {
      await expect(runEnvCommand("edit", "missing")).rejects.toThrow("does not exist");
    });

    it("handles edit envFile option", async () => {
      select.mockResolvedValueOnce("envFile");
      confirm.mockResolvedValueOnce(true);
      text.mockResolvedValueOnce(".env.modified");
      const res = await runEnvCommand("edit", "dev");
      expect(res.status).toBe("success");
      expect(writeConfig).toHaveBeenCalled();
    });

    it("handles edit vars option (add variable)", async () => {
      select.mockResolvedValueOnce("vars")
            .mockResolvedValueOnce("add");
      confirm.mockResolvedValueOnce(true); // add or update var
      text.mockResolvedValueOnce("NEW_KEY")
          .mockResolvedValueOnce("NEW_VAL");
      confirm.mockResolvedValueOnce(false); // add another var = false
      const res = await runEnvCommand("edit", "dev");
      expect(res.status).toBe("success");
      expect(writeConfig).toHaveBeenCalled();
    });

    it("handles edit vars option (delete variable)", async () => {
      select.mockResolvedValueOnce("vars")
            .mockResolvedValueOnce("delete")
            .mockResolvedValueOnce("A");
      const res = await runEnvCommand("edit", "dev");
      expect(res.status).toBe("success");
      expect(writeConfig).toHaveBeenCalled();
    });

    it("handles edit vars option (update variable)", async () => {
      select.mockResolvedValueOnce("vars")
            .mockResolvedValueOnce("update")
            .mockResolvedValueOnce("A");
      text.mockResolvedValueOnce("updated_value");
      const res = await runEnvCommand("edit", "dev");
      expect(res.status).toBe("success");
      expect(writeConfig).toHaveBeenCalled();
    });

    it("handles remove environment that does not exist", async () => {
      await expect(runEnvCommand("remove", "missing")).rejects.toThrow("does not exist");
    });

    it("handles remove default environment with multiple envs", async () => {
      await expect(runEnvCommand("remove", "dev")).rejects.toThrow("Cannot remove default environment");
    });

    it("handles remove environment user cancel", async () => {
      confirm.mockResolvedValueOnce(false); // shouldRemove = false
      const res = await runEnvCommand("remove", "prod");
      expect(res.status).toBe("success");
      expect(writeConfig).not.toHaveBeenCalled();
    });

    it("handles set-default with no environments", async () => {
      loadConfig.mockResolvedValueOnce({
        projectName: "Test",
        defaultEnvironment: "",
        environments: {}
      } as any);
      await expect(runEnvCommand("set-default")).rejects.toThrow("No environments configured");
    });

    it("handles set-default with non-existent environment", async () => {
      await expect(runEnvCommand("set-default", "missing")).rejects.toThrow("does not exist");
    });

    it("handles detect when no env files detected", async () => {
      fs.readdir.mockResolvedValueOnce([]);
      const res = await runEnvCommand("detect");
      expect(res.status).toBe("success");
      expect(writeConfig).not.toHaveBeenCalled();
    });

    it("handles detect user cancel", async () => {
      fs.readdir.mockResolvedValueOnce([
          { name: ".env.staging", isFile: () => true, isDirectory: () => false } as any
      ]);
      confirm.mockResolvedValueOnce(false); // shouldImport = false
      const res = await runEnvCommand("detect");
      expect(res.status).toBe("success");
      expect(writeConfig).not.toHaveBeenCalled();
    });

    it("handles user cancellation (CANCELLED error)", async () => {
      select.mockImplementationOnce(() => Promise.reject(new Error("Operation cancelled")));
      const res = await runEnvCommand();
      expect(res.status).toBe("cancelled");
    });

    it("unwraps cancelled symbol as throw", async () => {
        const CANCEL_VAL = Symbol("CANCEL");
        isCancel.mockImplementation((val) => val === CANCEL_VAL);
        select.mockResolvedValueOnce(CANCEL_VAL);
        const res = await runEnvCommand("view");
        expect(res.status).toBe("cancelled");
    });

    it("handles loadConfigForEnvCommand fallback when file is empty", async () => {
        loadConfig.mockRejectedValueOnce(new Error("load failed"));
        fs.pathExists.mockResolvedValueOnce(true);
        fs.readFile.mockResolvedValueOnce(""); // Empty file -> null from yaml.load
        await expect(runEnvCommand("list")).rejects.toThrow("load failed");
    });

    it("handles add environment and it becomes default automatically if it is the first one", async () => {
        loadConfig.mockResolvedValueOnce({
            projectName: "Test",
            defaultEnvironment: "",
            environments: {}
        } as any);
        text.mockResolvedValueOnce("first") // name
            .mockResolvedValueOnce(".env.first"); // file
        confirm.mockResolvedValueOnce(true) // Link file
               .mockResolvedValueOnce(false); // Add vars? No
        const res = await runEnvCommand("add");
        expect(res.status).toBe("success");
        expect(writeConfig).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            defaultEnvironment: "first"
        }));
    });

    it("handles view environment with no values", async () => {
        loadConfig.mockResolvedValueOnce({
            projectName: "Test",
            environments: { empty: {} }
        } as any);
        const res = await runEnvCommand("view", "empty");
        expect(res.status).toBe("success");
    });

    it("handles add environment and setting it as default", async () => {
        loadConfig.mockResolvedValueOnce({
            projectName: "Test",
            defaultEnvironment: "dev",
            environments: { dev: {} }
        } as any);
        text.mockResolvedValueOnce("prod") // name
            .mockResolvedValueOnce(".env.prod"); // file
        confirm.mockResolvedValueOnce(true) // Link file
               .mockResolvedValueOnce(false) // Add vars? No
               .mockResolvedValueOnce(true); // Set as default? Yes
        const res = await runEnvCommand("add");
        expect(res.status).toBe("success");
        expect(writeConfig).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            defaultEnvironment: "prod"
        }));
    });

    it("handles edit and ensures vars object exists", async () => {
        loadConfig.mockResolvedValueOnce({
            projectName: "Test",
            environments: { dev: {} }
        } as any);
        select.mockResolvedValueOnce("vars");
        confirm.mockResolvedValueOnce(false); // Add or update? No
        const res = await runEnvCommand("edit", "dev");
        expect(res.status).toBe("success");
    });

    it("handles remove with no environments", async () => {
        loadConfig.mockResolvedValueOnce({ projectName: "Test", environments: {} } as any);
        const res = await runEnvCommand("remove");
        expect(res.status).toBe("success");
    });

    it("handles remove and resets default if removed was default and only env", async () => {
        const singleEnvConfig = {
            projectName: "Test",
            defaultEnvironment: "dev",
            environments: { dev: {} },
            builds: { development: {}, adhoc: {}, store: {} }
        };
        loadConfig.mockResolvedValue(singleEnvConfig as any);
        confirm.mockResolvedValue(true);
        const res = await runEnvCommand("remove", "dev");
        expect(res.status).toBe("success");
        expect(writeConfig).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            defaultEnvironment: ""
        }));
    });

    it("handles detect and sets default if none existed", async () => {
        loadConfig.mockResolvedValueOnce({ projectName: "Test", environments: {} } as any);
        fs.readdir.mockResolvedValueOnce([
            { name: ".env.development", isFile: () => true, isDirectory: () => false } as any
        ]);
        confirm.mockResolvedValueOnce(true);
        const res = await runEnvCommand("detect");
        expect(res.status).toBe("success");
        expect(writeConfig).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            defaultEnvironment: "development"
        }));
    });
  });
});
