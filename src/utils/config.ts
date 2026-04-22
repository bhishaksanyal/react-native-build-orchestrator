import path from "node:path";
import fs from "fs-extra";
import yaml from "js-yaml";

import { parseConfig } from "../schema.js";
import type { RNBuildConfig } from "../types.js";

export const CONFIG_FILE = ".rnbuildrc.yml";

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
  const serialized = yaml.dump(config, {
    noRefs: true,
    lineWidth: 120,
    sortKeys: false
  });

  await fs.writeFile(configPath, serialized, "utf8");
  return configPath;
}
