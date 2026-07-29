import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";

import { parseConfig } from "../schema.js";
import type { RNBuildConfig } from "../types.js";

export const CONFIG_FILE = ".rnbuildrc.yml";

/** URL to the published JSON Schema for .rnbuildrc.yml */
const SCHEMA_URL =
  "https://raw.githubusercontent.com/bhishaksanyal/react-native-build-orchestrator/main/schemas/rnbuildrc.schema.json";

export async function loadConfig(projectDir: string): Promise<RNBuildConfig> {
  const configPath = path.join(projectDir, CONFIG_FILE);
  const exists = await fs.pathExists(configPath);
  if (!exists) {
    throw new Error(`Missing ${CONFIG_FILE}. Run 'rnbuild init' first.`);
  }

  const raw = await fs.readFile(configPath, "utf8");
  const parsed = yaml.load(raw);
  return parseConfig(parsed);
}

export async function writeConfig(projectDir: string, config: RNBuildConfig): Promise<string> {
  const configPath = path.join(projectDir, CONFIG_FILE);

  // Inject $schema reference for IDE autocompletion and validation.
  // The key is ignored by Zod parsing (unknown keys are stripped).
  const output = { $schema: SCHEMA_URL, ...config } as Record<string, unknown>;

  const serialized = yaml.dump(output, {
    noRefs: true,
    lineWidth: 120,
    sortKeys: false
  });

  await fs.writeFile(configPath, serialized, "utf8");
  return configPath;
}
