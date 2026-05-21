/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

// Mock all command handlers
jest.unstable_mockModule("../../commands/init.js", () => ({ runInitCommand: jest.fn().mockImplementation(() => Promise.resolve()) }));
jest.unstable_mockModule("../../commands/build.js", () => ({ runBuildCommand: jest.fn().mockImplementation(() => Promise.resolve()) }));
jest.unstable_mockModule("../../commands/doctor.js", () => ({ runDoctorCommand: jest.fn().mockImplementation(() => Promise.resolve()) }));
jest.unstable_mockModule("../../commands/env.js", () => ({ runEnvCommand: jest.fn().mockImplementation(() => Promise.resolve()) }));
jest.unstable_mockModule("../../commands/fastlane.js", () => ({ runFastlaneSetupCommand: jest.fn().mockImplementation(() => Promise.resolve()) }));
jest.unstable_mockModule("../../commands/flavor.js", () => ({ runFlavorCommand: jest.fn().mockImplementation(() => Promise.resolve()) }));
jest.unstable_mockModule("../../commands/release.js", () => ({ runReleaseCommand: jest.fn().mockImplementation(() => Promise.resolve()) }));
jest.unstable_mockModule("../../commands/run.js", () => ({ runAppCommand: jest.fn().mockImplementation(() => Promise.resolve()) }));
jest.unstable_mockModule("../../commands/version.js", () => ({ runVersionCommand: jest.fn().mockImplementation(() => Promise.resolve()) }));

let registeredCommands: any[] = [];

// Mock commander
jest.unstable_mockModule("commander", () => {
    return {
        program: {
            name: jest.fn().mockReturnThis(),
            description: jest.fn().mockReturnThis(),
            version: jest.fn().mockReturnThis(),
            command: jest.fn().mockImplementation((...args: any[]) => {
                const name = args[0];
                const cmd = {
                    description: jest.fn().mockReturnThis(),
                    option: jest.fn().mockReturnThis(),
                    action: jest.fn().mockImplementation(function(this: any, cb: any) {
                        this._actionHandler = cb;
                        return this;
                    }),
                    _name: name,
                    _actionHandler: null as any
                };
                registeredCommands.push(cmd);
                return cmd;
            }),
            parseAsync: jest.fn().mockImplementation(async () => {}),
            commands: []
        }
    };
});

describe("CLI entry point", () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    jest.clearAllMocks();
    registeredCommands = [];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.argv = originalArgv;
  });

  it("registers all commands and handles their actions", async () => {
    const { program } = await import("commander") as any;
    jest.spyOn(console, "error").mockImplementation(() => {});

    await import(`../../index.js?t=${Date.now()}`);

    for (const cmd of registeredCommands) {
        if (cmd._actionHandler) {
            await cmd._actionHandler({});
        }
    }

    expect(program.name).toHaveBeenCalledWith("rnbuild");
  });

  it("covers catch blocks in index.ts for all commands", async () => {
      const { runInitCommand } = await import("../../commands/init.js") as any;
      const { runBuildCommand } = await import("../../commands/build.js") as any;
      const { runDoctorCommand } = await import("../../commands/doctor.js") as any;
      const { runEnvCommand } = await import("../../commands/env.js") as any;
      const { runFastlaneSetupCommand } = await import("../../commands/fastlane.js") as any;
      const { runFlavorCommand } = await import("../../commands/flavor.js") as any;
      const { runReleaseCommand } = await import("../../commands/release.js") as any;
      const { runAppCommand } = await import("../../commands/run.js") as any;
      const { runVersionCommand } = await import("../../commands/version.js") as any;

      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await import(`../../index.js?t=catch&v=${Date.now()}`);

      const mocks: any = {
          init: runInitCommand,
          build: runBuildCommand,
          doctor: runDoctorCommand,
          env: runEnvCommand,
          fastlane: runFastlaneSetupCommand,
          flavor: runFlavorCommand,
          release: runReleaseCommand,
          run: runAppCommand,
          version: runVersionCommand
      };

      for (const [name, mock] of Object.entries(mocks)) {
          (mock as any).mockRejectedValueOnce(new Error(`${name} fail`));
          (mock as any).mockRejectedValueOnce(`${name} string fail`);
          const cmd = registeredCommands.find(c => c._name.startsWith(name));
          if (cmd && cmd._actionHandler) {
              // Test Error instance
              if (name === "fastlane") await cmd._actionHandler("setup", {});
              else if (name === "env" || name === "flavor") await cmd._actionHandler("list", "android", "name");
              else await cmd._actionHandler({});
              expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`${name} fail`));

              // Test string throw
              if (name === "fastlane") await cmd._actionHandler("setup", {});
              else if (name === "env" || name === "flavor") await cmd._actionHandler("list", "android", "name");
              else await cmd._actionHandler({});
              expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`${name} string fail`));
          }
      }
  });

  it("covers specific logic branches in index.ts", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      await import(`../../index.js?t=logic&v=${Date.now()}`);

      const fastlaneCmd = registeredCommands.find(c => c._name.startsWith("fastlane"));
      await (fastlaneCmd as any)._actionHandler();
      await (fastlaneCmd as any)._actionHandler("invalid");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid action"));

      const envCmd = registeredCommands.find(c => c._name.startsWith("env"));
      await (envCmd as any)._actionHandler();
      await (envCmd as any)._actionHandler("invalid");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid action"));

      const flavorCmd = registeredCommands.find(c => c._name.startsWith("flavor"));
      await (flavorCmd as any)._actionHandler();
      await (flavorCmd as any)._actionHandler("invalid");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid action"));
      await (flavorCmd as any)._actionHandler("list", "invalid");
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Platform must be one of"));
  });

  it("covers CI mode and cancellation flows in index.ts", async () => {
      const { runInitCommand } = await import("../../commands/init.js") as any;
      const { setCiMode } = await import("../../utils/logger.js") as any;
      const stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      await import(`../../index.js?t=ci&v=${Date.now()}`);

      const initCmd = registeredCommands.find(c => c._name === "init");

      // 1. Success result in CI mode
      runInitCommand.mockResolvedValueOnce({ status: "success" });
      await initCmd._actionHandler({ ci: true });
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("success"));

      // 2. Error result in CI mode sets process.exitCode = 1
      runInitCommand.mockResolvedValueOnce({ status: "error" });
      process.exitCode = 0;
      await initCmd._actionHandler({ ci: true });
      expect(process.exitCode).toBe(1);

      // 3. Exception in CI mode
      runInitCommand.mockRejectedValueOnce(new Error("CI exception"));
      await initCmd._actionHandler({ ci: true });
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("CI exception"));

      // 4. Cancellation in non-CI mode
      runInitCommand.mockRejectedValueOnce(new Error("Operation cancelled"));
      setCiMode(false);
      process.exitCode = -1;
      await initCmd._actionHandler({});
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Operation cancelled"));
      expect(process.exitCode).toBe(0);

      // 5. Cancellation in CI mode
      runInitCommand.mockRejectedValueOnce(new Error("Operation cancelled"));
      setCiMode(true);
      logSpy.mockClear();
      process.exitCode = -1;
      await initCmd._actionHandler({ ci: true });
      expect(logSpy).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(0);

      // 6. Explicit "Operation cancelled" throw
      runInitCommand.mockRejectedValueOnce(new Error("Operation cancelled"));
      setCiMode(false);
      logSpy.mockClear();
      await initCmd._actionHandler({});
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Operation cancelled"));

      stdoutSpy.mockRestore();
      logSpy.mockRestore();
  });
});
