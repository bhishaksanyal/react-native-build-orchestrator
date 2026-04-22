import fs from "fs-extra";

export function parseDotEnv(contents: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^['\"]|['\"]$/g, "");
    if (key) {
      vars[key] = value;
    }
  }
  return vars;
}

export async function readDotEnv(filePath: string): Promise<Record<string, string>> {
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    return {};
  }
  const raw = await fs.readFile(filePath, "utf8");
  return parseDotEnv(raw);
}

export function interpolate(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
