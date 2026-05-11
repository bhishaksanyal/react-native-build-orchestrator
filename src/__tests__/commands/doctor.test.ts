/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    pathExists: jest.fn()
  }
}));
jest.unstable_mockModule("@clack/prompts", () => ({
  intro: jest.fn(),
  outro: jest.fn(),
  note: jest.fn()
}));

const { runDoctorCommand } = await import("../../commands/doctor.js");
const fs = (await import("fs-extra")).default as any;

describe("doctor command", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes when all files exist", async () => {
    fs.pathExists.mockResolvedValue(true);
    await runDoctorCommand();
  });

  it("fails gracefully when files are missing", async () => {
      fs.pathExists.mockResolvedValue(false);
      await runDoctorCommand("/some/path");
  });
});
