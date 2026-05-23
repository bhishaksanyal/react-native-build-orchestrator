/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("@clack/prompts", () => ({
  intro: jest.fn<any>(),
  outro: jest.fn<any>(),
  spinner: jest.fn<any>(),
  text: jest.fn<any>(),
  select: jest.fn<any>(),
  confirm: jest.fn<any>(),
  isCancel: jest.fn<any>().mockImplementation((v: any) => v === "__CANCEL__")
}));

const {
  setCiMode,
  getCiMode,
  log,
  intro,
  outro,
  spinner,
  printJson,
  checkCancel,
  promptSelect,
  promptText,
  promptConfirm,
  isCancel: exportedIsCancel
} = await import("../../utils/logger.js");

const {
  intro: clackIntro,
  outro: clackOutro,
  spinner: clackSpinner,
  text: clackText,
  select: clackSelect,
  confirm: clackConfirm,
  isCancel: clackIsCancel
} = await import("@clack/prompts") as any;

describe("logger utility", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setCiMode(false);
    clackIsCancel.mockImplementation((v: any) => v === "__CANCEL__");
  });

  describe("CI mode toggle", () => {
    it("gets and sets CI mode status", () => {
      expect(getCiMode()).toBe(false);
      setCiMode(true);
      expect(getCiMode()).toBe(true);
    });
  });

  describe("log, intro, outro in interactive mode", () => {
    let logSpy: any;

    beforeEach(() => {
      logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it("logs message via console.log", () => {
      log("test message");
      expect(logSpy).toHaveBeenCalledWith("test message");
    });

    it("triggers clack intro message", () => {
      intro("hello");
      expect(clackIntro).toHaveBeenCalledWith("hello");
    });

    it("triggers clack outro message", () => {
      outro("goodbye");
      expect(clackOutro).toHaveBeenCalledWith("goodbye");
    });

    it("returns clack spinner", () => {
      const dummySpinner = { start: jest.fn(), stop: jest.fn() };
      clackSpinner.mockReturnValue(dummySpinner);
      const res = spinner();
      expect(res).toBe(dummySpinner);
    });
  });

  describe("log, intro, outro in CI mode", () => {
    let stderrSpy: any;

    beforeEach(() => {
      setCiMode(true);
      stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    afterEach(() => {
      stderrSpy.mockRestore();
    });

    it("logs message to stderr stream", () => {
      log("stderr message");
      expect(stderrSpy).toHaveBeenCalledWith("stderr message\n");
    });

    it("logs intro to stderr stream", () => {
      intro("hello ci");
      expect(stderrSpy).toHaveBeenCalledWith("hello ci\n");
    });

    it("logs outro to stderr stream", () => {
      outro("goodbye ci");
      expect(stderrSpy).toHaveBeenCalledWith("goodbye ci\n");
    });

    it("returns a CI-compatible spinner", () => {
      const ciSpinner = spinner();
      expect(ciSpinner).toHaveProperty("start");
      expect(ciSpinner).toHaveProperty("stop");
      expect(ciSpinner).toHaveProperty("message");

      ciSpinner.start("ci start");
      expect(stderrSpy).toHaveBeenCalledWith("ci start\n");

      ciSpinner.stop("ci stop");
      expect(stderrSpy).toHaveBeenCalledWith("ci stop\n");

      ciSpinner.message("ci msg");
      expect(stderrSpy).toHaveBeenCalledWith("ci msg\n");

      // Verify no-op when message is undefined
      stderrSpy.mockClear();
      ciSpinner.start();
      ciSpinner.stop();
      ciSpinner.message();
      expect(stderrSpy).not.toHaveBeenCalled();
    });
  });

  describe("printJson utility", () => {
    let stdoutSpy: any;

    beforeEach(() => {
      stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it("prints stringified JSON to stdout", () => {
      printJson({ a: 1 });
      expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify({ a: 1 }, null, 2) + "\n");
    });
  });

  describe("checkCancel utility", () => {
    it("returns false if value is not cancel symbol", () => {
      expect(checkCancel("ok")).toBe(false);
    });

    it("throws cancelled error if value is cancel symbol", () => {
      expect(() => checkCancel("__CANCEL__")).toThrow("Operation cancelled");
    });
  });

  describe("promptSelect utility", () => {
    it("throws error in CI mode", async () => {
      setCiMode(true);
      await expect(promptSelect({ message: "select one", options: [] })).rejects.toThrow("Prompt required but running in CI mode: select one");
    });

    it("throws error if prompt is cancelled in interactive mode", async () => {
      clackSelect.mockResolvedValue("__CANCEL__");
      await expect(promptSelect({ message: "select one", options: [] })).rejects.toThrow("Operation cancelled");
    });

    it("returns selected value if successful", async () => {
      clackSelect.mockResolvedValue("selected_val");
      const val = await promptSelect({ message: "select one", options: [] });
      expect(val).toBe("selected_val");
    });
  });

  describe("promptText utility", () => {
    it("throws error in CI mode", async () => {
      setCiMode(true);
      await expect(promptText({ message: "type text" })).rejects.toThrow("Prompt required but running in CI mode: type text");
    });

    it("throws error if prompt is cancelled in interactive mode", async () => {
      clackText.mockResolvedValue("__CANCEL__");
      await expect(promptText({ message: "type text" })).rejects.toThrow("Operation cancelled");
    });

    it("returns inputted value if successful", async () => {
      clackText.mockResolvedValue("user text");
      const val = await promptText({ message: "type text" });
      expect(val).toBe("user text");
    });
  });

  describe("promptConfirm utility", () => {
    it("returns initialValue if in CI mode, defaulting to true", async () => {
      setCiMode(true);
      const val1 = await promptConfirm({ message: "confirm", initialValue: false });
      expect(val1).toBe(false);

      const val2 = await promptConfirm({ message: "confirm" });
      expect(val2).toBe(true);
    });

    it("throws error if prompt is cancelled in interactive mode", async () => {
      clackConfirm.mockResolvedValue("__CANCEL__");
      await expect(promptConfirm({ message: "confirm" })).rejects.toThrow("Operation cancelled");
    });

    it("returns boolean value if successful", async () => {
      clackConfirm.mockResolvedValue(true);
      const val = await promptConfirm({ message: "confirm" });
      expect(val).toBe(true);
    });
  });

  describe("exportedIsCancel", () => {
    it("re-exports isCancel helper", () => {
      expect(exportedIsCancel("__CANCEL__")).toBe(true);
      expect(exportedIsCancel("other")).toBe(false);
    });
  });
});
