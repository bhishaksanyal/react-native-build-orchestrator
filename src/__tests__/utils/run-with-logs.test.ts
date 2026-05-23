import { jest } from "@jest/globals";
import { Readable } from "stream";

jest.unstable_mockModule("execa", () => ({
  execa: jest.fn()
}));

const { execa } = await import("execa") as any;
const { runCommandWithLogs } = await import("../../utils/run-with-logs.js");

function createMockChild(chunks: string[], exitCode = 0) {
    return {
        all: Readable.from(chunks.map(c => Buffer.from(c))),
        exitCode
    };
}

describe("runCommandWithLogs", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("handles rawLogs with streaming lines", async () => {
        execa.mockReturnValue(createMockChild(["line1\n", "line2\n", "line3\n"]));
        const result = await runCommandWithLogs({
            command: "echo hi",
            cwd: "/app",
            env: {},
            rawLogs: true
        });
        expect(result.exitCode).toBe(0);
        expect(result.rawLines).toEqual(["line1", "line2", "line3"]);
    });

    it("handles rawLogs with pending data (no trailing newline)", async () => {
        execa.mockReturnValue(createMockChild(["line1\n", "pending"]));
        const result = await runCommandWithLogs({
            command: "echo hi",
            cwd: "/app",
            env: {},
            rawLogs: true
        });
        expect(result.exitCode).toBe(0);
        expect(result.rawLines).toEqual(["line1", "pending"]);
    });

    it("handles onLine callback for stream and pending", async () => {
        const lines: string[] = [];
        execa.mockReturnValue(createMockChild(["hello\n", "world"]));
        const result = await runCommandWithLogs({
            command: "echo hi",
            cwd: "/app",
            env: {},
            rawLogs: false,
            onLine: (line) => { lines.push(line); }
        });
        expect(result.exitCode).toBe(0);
        expect(lines).toEqual(["hello", "world"]);
    });

    it("handles no onLine, no rawLogs, no styler (else path)", async () => {
        execa.mockReturnValue(createMockChild(["data\n", "leftover"]));
        const result = await runCommandWithLogs({
            command: "echo hi",
            cwd: "/app",
            env: {},
            rawLogs: false
        });
        expect(result.exitCode).toBe(0);
        expect(result.rawLines).toEqual(["data", "leftover"]);
    });

    it("handles child.all being null", async () => {
        execa.mockReturnValue({ all: null, exitCode: 0 });
        const result = await runCommandWithLogs({
            command: "echo hi",
            cwd: "/app",
            env: {},
            rawLogs: false
        });
        expect(result.exitCode).toBe(0);
        expect(result.rawLines).toEqual([]);
    });

    it("handles styler with pending data", async () => {
        let lastLogged = "";
        execa.mockReturnValue(createMockChild(["pending data"]));
        const result = await runCommandWithLogs({
            command: "echo hi",
            cwd: "/app",
            env: {},
            rawLogs: false,
            styler: (line) => {
                lastLogged = line;
                return `STYLED: ${line}`;
            }
        });
        expect(result.exitCode).toBe(0);
        expect(lastLogged).toBe("pending data");
    });

    it("handles styler returning empty string with pending data", async () => {
        execa.mockReturnValue(createMockChild(["skip me"]));
        const result = await runCommandWithLogs({
            command: "echo hi",
            cwd: "/app",
            env: {},
            rawLogs: false,
            styler: () => ""
        });
        expect(result.exitCode).toBe(0);
        expect(result.rawLines).toEqual(["skip me"]);
    });

    it("handles exitCode being null", async () => {
        execa.mockReturnValue(createMockChild(["done\n"], null as any));
        const result = await runCommandWithLogs({
            command: "echo hi",
            cwd: "/app",
            env: {},
            rawLogs: true
        });
        expect(result.exitCode).toBe(0);
        expect(result.rawLines).toEqual(["done"]);
    });
});
