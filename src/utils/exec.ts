import path from "node:path";
import fs from "fs-extra";
import { execa } from "execa";
import { styleLine, stylePrettyLine, styleRunLine } from "./log-styling.js";
import type { Platform } from "../types.js";

export interface ExecOptions {
  command: string;
  cwd: string;
  env: Record<string, string | undefined>;
  rawLogs: boolean;
  logToFilePath?: string;
  /**
   * If true, use stylePrettyLine, otherwise styleLine.
   */
  pretty?: boolean;
  /**
   * Optional callback for each line.
   */
  onLine?: (line: string) => void;
  /**
   * Custom error message if the command fails.
   */
  errorMessage?: string;
  /**
   * If provided, use styleRunLine for styling.
   */
  platform?: Platform | "unknown";
}

export async function runCommandWithLogs(params: ExecOptions): Promise<void> {
  if (params.logToFilePath) {
    await fs.ensureDir(path.dirname(params.logToFilePath));
  }

  const child = execa(params.command, {
    cwd: params.cwd,
    shell: true,
    env: params.env,
    all: true,
    reject: false
  });

  let pending = "";
  let rawLog = "";

  const styler = params.platform
    ? (line: string) => styleRunLine(line, params.platform!)
    : params.pretty
      ? stylePrettyLine
      : styleLine;

  if (child.all) {
    for await (const chunk of child.all) {
      const text = chunk.toString();
      rawLog += text;
      pending += text;

      while (pending.includes("\n")) {
        const newlineIndex = pending.indexOf("\n");
        const line = pending.slice(0, newlineIndex).replace(/\r$/, "");
        pending = pending.slice(newlineIndex + 1);

        if (params.onLine) {
          params.onLine(line);
        }

        if (params.rawLogs) {
          console.log(line);
        } else {
          const styled = styler(line);
          if (styled) {
            console.log(styled);
          }
        }
      }
    }
  }

  if (pending.trim()) {
    rawLog += `${pending}\n`;

    if (params.onLine) {
      params.onLine(pending);
    }

    if (params.rawLogs) {
      console.log(pending);
    } else {
      const styled = styler(pending);
      if (styled) {
        console.log(styled);
      }
    }
  }

  if (params.logToFilePath) {
    await fs.writeFile(params.logToFilePath, rawLog, "utf8");
  }

  const result = await child;
  if (result.exitCode !== 0) {
    if (params.errorMessage) {
      throw new Error(params.errorMessage);
    }
    const errorMsg = params.logToFilePath
      ? `Command failed. Full logs: ${params.logToFilePath}`
      : "Command failed.";
    throw new Error(errorMsg);
  }
}
