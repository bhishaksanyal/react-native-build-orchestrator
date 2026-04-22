import path from "node:path";

import type { RNBuildConfig } from "../types.js";
import { readDotEnv } from "./env.js";
import { createRuntimeVars, writeRuntimeEnvExports } from "./runtime-exports.js";

export async function syncRuntimeEnvFromConfig(
  projectDir: string,
  config: RNBuildConfig,
  environmentName?: string
): Promise<
  | {
      envName: string;
      runtimeEnvFilePath: string;
      runtimeWrapperPath: string;
      runtimeTsPath: string;
    }
  | null
> {
  const envName = environmentName ?? config.defaultEnvironment;
  if (!envName) {
    return null;
  }

  const envConfig = config.environments[envName];
  if (!envConfig) {
    return null;
  }

  const envFilePath = envConfig.envFile ? path.resolve(projectDir, envConfig.envFile) : "";
  const envFileVars = envConfig.envFile ? await readDotEnv(envFilePath) : {};

  const runtimeVars = createRuntimeVars({
    envName,
    buildType: "development",
    envFileVars,
    envConfigVars: envConfig.vars ?? {}
  });

  const artifacts = await writeRuntimeEnvExports(projectDir, envName, runtimeVars);
  return {
    envName,
    runtimeEnvFilePath: artifacts.runtimeEnvFilePath,
    runtimeWrapperPath: artifacts.runtimeWrapperPath,
    runtimeTsPath: artifacts.runtimeTsPath
  };
}
