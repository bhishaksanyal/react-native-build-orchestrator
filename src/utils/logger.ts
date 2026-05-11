import { intro as clackIntro, outro as clackOutro, spinner as clackSpinner, text, select, confirm, isCancel } from "@clack/prompts";
export { isCancel };
import pc from "picocolors";

let isCiMode = false;

export function setCiMode(ci: boolean): void {
  isCiMode = ci;
}

export function getCiMode(): boolean {
  return isCiMode;
}

export function log(msg: string): void {
  if (isCiMode) {
    process.stderr.write(`${msg}\n`);
  } else {
    console.log(msg);
  }
}

export function intro(msg: string): void {
  if (isCiMode) {
    log(msg);
  } else {
    clackIntro(msg);
  }
}

export function outro(msg: string): void {
  if (isCiMode) {
    log(msg);
  } else {
    clackOutro(msg);
  }
}

export function spinner(): ReturnType<typeof clackSpinner> {
  if (isCiMode) {
    return {
      start: (msg?: string) => {
        if (msg) log(msg);
      },
      stop: (msg?: string, code?: number) => {
        if (msg) log(msg);
      },
      message: (msg?: string) => {
        if (msg) log(msg);
      }
    };
  }
  return clackSpinner();
}

export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

export function checkCancel(value: unknown): boolean {
  if (isCancel(value)) {
    outro(pc.yellow("Operation cancelled."));
    process.exit(0);
  }
  return false;
}

export async function promptSelect<T = string>(options: Parameters<typeof select>[0]): Promise<T> {
  if (isCiMode) {
    throw new Error(`Prompt required but running in CI mode: ${(options as { message: string }).message}`);
  }
  const result = await select(options);
  if (isCancel(result)) {
    outro(pc.yellow("Operation cancelled."));
    process.exit(0);
  }
  return result as T;
}

export async function promptText(options: Parameters<typeof text>[0]): Promise<string> {
  if (isCiMode) {
    throw new Error(`Prompt required but running in CI mode: ${(options as { message: string }).message}`);
  }
  const result = await text(options);
  if (isCancel(result)) {
    outro(pc.yellow("Operation cancelled."));
    process.exit(0);
  }
  return String(result);
}

export async function promptConfirm(options: Parameters<typeof confirm>[0]): Promise<boolean> {
  if (isCiMode) {
    return (options as { initialValue?: boolean }).initialValue ?? true;
  }
  const result = await confirm(options);
  if (isCancel(result)) {
    outro(pc.yellow("Operation cancelled."));
    process.exit(0);
  }
  return Boolean(result);
}
