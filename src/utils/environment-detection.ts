import path from "node:path";
import fs from "fs-extra";

import type { EnvironmentConfig } from "../types.js";
import { readDotEnv } from "./env.js";

function inferEnvName(fileName: string): string {
  if (fileName === ".env") {
    return "development";
  }

  const suffix = fileName.replace(/^\.env\./, "");
  const normalized = suffix.toLowerCase();

  if (normalized === "dev" || normalized === "development") {
    return "development";
  }
  if (normalized === "prod" || normalized === "production") {
    return "production";
  }
  if (normalized === "stg" || normalized === "stage" || normalized === "staging") {
    return "staging";
  }

  return suffix;
}

export async function detectEnvironmentsFromDotEnv(
  projectDir: string
): Promise<Record<string, EnvironmentConfig>> {
  const entries = await fs.readdir(projectDir, { withFileTypes: true });
  const envFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name === ".env" || /^\.env\.[^\s]+$/.test(name))
    .filter((name) => name !== ".env.example" && name !== ".env.sample")
    .sort((left, right) => left.localeCompare(right));

  const result: Record<string, EnvironmentConfig> = {};

  for (const fileName of envFiles) {
    const envName = inferEnvName(fileName);
    const vars = await readDotEnv(path.join(projectDir, fileName));

    result[envName] = {
      envFile: fileName,
      vars
    };
  }

  return result;
}