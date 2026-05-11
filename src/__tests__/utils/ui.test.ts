/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

const { banner, info, success, warn, fail, createTable } = await import("../../utils/ui.js");

describe("ui utility", () => {
  let logSpy: any;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("banner logs to console", () => {
    banner("test");
    expect(logSpy).toHaveBeenCalled();
  });

  it("info logs to console", () => {
    info("test");
    expect(logSpy).toHaveBeenCalled();
  });

  it("success logs to console", () => {
    success("test");
    expect(logSpy).toHaveBeenCalled();
  });

  it("warn logs to console", () => {
    warn("test");
    expect(logSpy).toHaveBeenCalled();
  });

  it("fail logs to console", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    fail("test");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("createTable returns a Table instance", () => {
    const table = createTable(["H1", "H2"]);
    expect(table).toBeDefined();
    expect((table as any).options.head).toHaveLength(2);
  });
});
