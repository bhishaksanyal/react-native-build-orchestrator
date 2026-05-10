import { intro as clackIntro, outro as clackOutro, spinner as clackSpinner, text, select, confirm, isCancel } from "@clack/prompts";
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

export function printJson(data: any): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

export function checkCancel(value: any | symbol): boolean {
  if (isCancel(value)) {
    outro(pc.yellow("Operation cancelled."));
    process.exit(0);
  }
  return false;
}

export async function promptSelect<T>(options: any): Promise<T> {
  if (isCiMode) {
    throw new Error(`Prompt required but running in CI mode: ${options.message}`);
  }
  const result = await select(options);
  if (isCancel(result)) {
    outro(pc.yellow("Operation cancelled."));
    process.exit(0);
  }
  return result as T;
}

export async function promptText(options: any): Promise<string> {
  if (isCiMode) {
    throw new Error(`Prompt required but running in CI mode: ${options.message}`);
  }
  const result = await text(options);
  if (isCancel(result)) {
    outro(pc.yellow("Operation cancelled."));
    process.exit(0);
  }
  return String(result);
}

export async function promptConfirm(options: any): Promise<boolean> {
  if (isCiMode) {
    return options.initialValue ?? true;
  }
  const result = await confirm(options);
  if (isCancel(result)) {
    outro(pc.yellow("Operation cancelled."));
    process.exit(0);
  }
  return Boolean(result);
}
