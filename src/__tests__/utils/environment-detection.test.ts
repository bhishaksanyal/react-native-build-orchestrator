/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("fs-extra", () => ({
  default: {
    readdir: jest.fn<any>().mockResolvedValue([])
  }
}));
jest.unstable_mockModule("../../utils/env.js", () => ({
  readDotEnv: jest.fn<any>().mockResolvedValue({})
}));

const { detectEnvironmentsFromDotEnv } = await import("../../utils/environment-detection.js");
const fs = (await import("fs-extra")).default as any;

describe("environment detection", () => {
  it("detects and infers environment names from .env files", async () => {
    (fs.readdir as any).mockResolvedValue([
      { name: ".env", isFile: () => true },
      { name: ".env.dev", isFile: () => true },
      { name: ".env.prod", isFile: () => true },
      { name: ".env.stg", isFile: () => true },
      { name: ".env.custom", isFile: () => true },
      { name: ".env.example", isFile: () => true },
      { name: "other.txt", isFile: () => true }
    ] as any);

    const results = await detectEnvironmentsFromDotEnv("/app");
    expect(results.development).toBeDefined();
    expect(results.production).toBeDefined();
    expect(results.staging).toBeDefined();
    expect(results.custom).toBeDefined();
    expect(results.example).toBeUndefined();
  });
});
