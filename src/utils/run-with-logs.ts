import { execa } from "execa";
import { log } from "./logger.js";

export interface RunWithLogsParams {
  command: string;
  cwd: string;
  env: Record<string, string | undefined>;
  rawLogs: boolean;
  styler?: (line: string) => string;
  onLine?: (line: string) => void;
}

export interface RunWithLogsResult {
  rawLines: string[];
  exitCode: number;
}

export async function runCommandWithLogs(
  params: RunWithLogsParams
): Promise<RunWithLogsResult> {
  const child = execa(params.command, {
    cwd: params.cwd,
    shell: true,
    env: params.env,
    all: true,
    reject: false
  });

  let pending = "";
  const rawLines: string[] = [];

  if (child.all) {
    for await (const chunk of child.all) {
      const text = chunk.toString();
      pending += text;

      while (pending.includes("\n")) {
        const newlineIndex = pending.indexOf("\n");
        const line = pending.slice(0, newlineIndex).replace(/\r$/, "");
        pending = pending.slice(newlineIndex + 1);
        rawLines.push(line);

        if (params.onLine) {
          params.onLine(line);
        } else if (params.rawLogs) {
          log(line);
        } else if (params.styler) {
          const styled = params.styler(line);
          if (styled) {
            log(styled);
          }
        } else {
          log(line);
        }
      }
    }
  }

  if (pending.trim()) {
    rawLines.push(pending);

    if (params.onLine) {
      params.onLine(pending);
    } else if (params.rawLogs) {
      log(pending);
    } else if (params.styler) {
      const styled = params.styler(pending);
      if (styled) {
        log(styled);
      }
    } else {
      log(pending);
    }
  }

  const result = await child;
  return { rawLines, exitCode: result.exitCode ?? 0 };
}
