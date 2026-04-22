import path from "node:path";
import { confirm, intro, isCancel, outro, select, text } from "@clack/prompts";
import pc from "picocolors";
import fs from "fs-extra";
import yaml from "js-yaml";
import { CONFIG_FILE, loadConfig, writeConfig } from "../utils/config.js";
import { detectEnvironmentsFromDotEnv } from "../utils/environment-detection.js";
import { readDotEnv } from "../utils/env.js";
import { syncRuntimeEnvFromConfig } from "../utils/sync-runtime-env.js";
import type { EnvironmentConfig, RNBuildConfig } from "../types.js";
import { createTable } from "../utils/ui.js";

type EnvAction = "list" | "view" | "add" | "edit" | "remove" | "set-default" | "detect";
type LoadedConfig = Awaited<ReturnType<typeof loadConfig>>;
const CANCELLED = "cancelled-by-user";

function unwrap<T>(value: T | symbol): T {
  if (isCancel(value)) {
    throw new Error(CANCELLED);
  }
  return value;
}

async function chooseEnv(envNames: string[], message: string, initialValue?: string): Promise<string> {
  const chosen = await select({
    message,
    options: envNames.map((name) => ({ value: name, label: name })),
    initialValue
  });
  return unwrap(chosen) as string;
}

async function inputText(message: string, defaultValue?: string, placeholder?: string): Promise<string> {
  const value = await text({ message, defaultValue, placeholder });
  return String(unwrap(value)).trim();
}

async function inputConfirm(message: string, initialValue = false): Promise<boolean> {
  const value = await confirm({ message, initialValue });
  return Boolean(unwrap(value));
}

async function loadConfigForEnvCommand(cwd: string): Promise<LoadedConfig> {
  try {
    return await loadConfig(cwd);
  } catch (error) {
    const configPath = path.join(cwd, CONFIG_FILE);
    const exists = await fs.pathExists(configPath);
    if (!exists) {
      throw error;
    }

    const rawContent = await fs.readFile(configPath, "utf8");
    const raw = (yaml.load(rawContent) as Record<string, unknown> | undefined) ?? {};
    const rawAsConfig = raw as unknown as Partial<RNBuildConfig>;

    if (!rawAsConfig.builds) {
      throw error;
    }

    const rawEnvironments =
      raw.environments && typeof raw.environments === "object"
        ? (raw.environments as Record<string, EnvironmentConfig>)
        : {};
    const envNames = Object.keys(rawEnvironments);

    const rawDefault = typeof raw.defaultEnvironment === "string" ? raw.defaultEnvironment : "";
    const normalizedDefault = rawEnvironments[rawDefault] ? rawDefault : envNames[0] ?? "";

    const normalized: RNBuildConfig = {
      ...rawAsConfig,
      projectName:
        typeof raw.projectName === "string" && raw.projectName.trim().length > 0
          ? raw.projectName
          : "my-rn-app",
      environments: rawEnvironments,
      defaultEnvironment: normalizedDefault,
      builds: rawAsConfig.builds
    };

    return normalized;
  }
}

export async function runEnvCommand(action?: EnvAction, envName?: string): Promise<void> {
  const cwd = process.cwd();
  const config = await loadConfigForEnvCommand(cwd);

  try {
    const selectedAction =
      action ??
      unwrap(
        await select({
          message: "Action",
          options: [
            { value: "list", label: "list" },
            { value: "view", label: "view" },
            { value: "add", label: "add" },
            { value: "edit", label: "edit" },
            { value: "remove", label: "remove" },
            { value: "set-default", label: "set-default" },
            { value: "detect", label: "detect" }
          ]
        })
      );

    switch (selectedAction as EnvAction) {
      case "list":
        await handleList(config);
        break;
      case "view":
        await handleView(cwd, config, envName);
        break;
      case "add":
        await handleAdd(cwd, config);
        break;
      case "edit":
        await handleEdit(cwd, config, envName);
        break;
      case "remove":
        await handleRemove(cwd, config, envName);
        break;
      case "set-default":
        await handleSetDefault(cwd, config, envName);
        break;
      case "detect":
        await handleDetect(cwd, config);
        break;
    }
  } catch (error) {
    if (error instanceof Error && error.message === CANCELLED) {
      outro(pc.yellow("Cancelled."));
      return;
    }
    throw error;
  }
}

async function handleList(config: LoadedConfig): Promise<void> {
  const envNames = Object.keys(config.environments);

  if (envNames.length === 0) {
    console.log(pc.yellow("No environments configured. Run 'rnbuild init' to add one."));
    return;
  }

  intro(pc.bold(pc.cyan("Environment Registry")));
  const table = createTable(["Environment", "Default", "Env File", "Variables"]);
  for (const envName of envNames) {
    const env = config.environments[envName];
    const varCount = Object.keys(env.vars ?? {}).length;
    table.push([
      pc.green(envName),
      envName === config.defaultEnvironment ? pc.green("yes") : pc.dim("no"),
      env.envFile ?? pc.dim("-"),
      String(varCount)
    ]);
  }
  console.log(table.toString());
  outro(pc.gray("Use 'rnbuild env set-default <name>' to change default environment."));
}

async function handleView(cwd: string, config: LoadedConfig, envNameArg?: string): Promise<void> {
  const envNames = Object.keys(config.environments);

  if (envNames.length === 0) {
    console.log(pc.yellow("No environments configured."));
    return;
  }

  const selectedEnv =
    envNameArg ??
    (await chooseEnv(envNames, "Select environment to view", config.defaultEnvironment || envNames[0]));

  if (!config.environments[selectedEnv]) {
    throw new Error(`Environment '${selectedEnv}' does not exist.`);
  }

  const env = config.environments[selectedEnv];
  intro(pc.bold(pc.cyan(`Environment: ${selectedEnv}`)));

  const table = createTable(["Source", "Key", "Value"]);

  if (env.envFile) {
    try {
      const fileVars = await readDotEnv(path.join(cwd, env.envFile));
      if (Object.keys(fileVars).length > 0) {
        for (const [key, value] of Object.entries(fileVars)) {
          table.push([pc.blue("env file"), key, value]);
        }
      } else {
        table.push([pc.blue("env file"), pc.dim("(empty)"), env.envFile]);
      }
    } catch {
      table.push([pc.yellow("env file"), pc.dim("(unreadable)"), env.envFile]);
    }
  }

  if (env.vars && Object.keys(env.vars).length > 0) {
    for (const [key, value] of Object.entries(env.vars)) {
      table.push([pc.magenta("config"), key, value]);
    }
  }

  if (table.length === 0) {
    table.push([pc.dim("-"), pc.dim("No values configured"), pc.dim("-")]);
  }

  console.log(table.toString());
  outro(pc.gray("Values shown from .rnbuildrc.yml and linked .env file."));
}

async function collectVars(initialVars: Record<string, string> = {}): Promise<Record<string, string>> {
  const vars: Record<string, string> = { ...initialVars };

  const shouldAdd = await inputConfirm("Add or update a variable?", Object.keys(vars).length === 0);
  if (!shouldAdd) {
    return vars;
  }

  let addMore = true;
  while (addMore) {
    const key = await inputText("Variable key", undefined, "BASE_URL");
    if (!key) {
      throw new Error("Variable key cannot be empty.");
    }

    const value = await inputText("Variable value");
    vars[key] = value;

    addMore = await inputConfirm("Add another variable?");
  }

  return vars;
}

async function handleAdd(cwd: string, config: LoadedConfig): Promise<void> {
  intro(pc.bold(pc.cyan("Add Environment")));

  const envName = await inputText("New environment name");
  if (!envName) {
    throw new Error("Name cannot be empty");
  }
  if (config.environments[envName]) {
    throw new Error(`Environment '${envName}' already exists`);
  }

  const useEnvFile = await inputConfirm("Link an .env file for this environment?");
  const envFile = useEnvFile ? await inputText("Path to env file", `.env.${envName}`) : undefined;

  const vars = await collectVars();

  const newEnv: EnvironmentConfig = {
    envFile,
    vars
  };

  config.environments[envName] = newEnv;

  if (!config.defaultEnvironment) {
    config.defaultEnvironment = envName;
  } else {
    const makeDefault = await inputConfirm("Set this as default environment?");
    if (makeDefault) {
      config.defaultEnvironment = envName;
    }
  }

  await writeConfig(cwd, config);
  await syncRuntimeEnvFromConfig(cwd, config);
  outro(pc.green(`Environment '${envName}' added successfully.`));
}

async function handleEdit(cwd: string, config: LoadedConfig, envNameArg?: string): Promise<void> {
  const envNames = Object.keys(config.environments);

  if (envNames.length === 0) {
    console.log(pc.yellow("No environments to edit."));
    return;
  }

  const selectedEnv =
    envNameArg ?? (await chooseEnv(envNames, "Select environment to edit", config.defaultEnvironment));

  if (!config.environments[selectedEnv]) {
    throw new Error(`Environment '${selectedEnv}' does not exist.`);
  }

  const env = config.environments[selectedEnv];

  const editChoice = unwrap(
    await select({
      message: "What to edit?",
      options: [
        { value: "vars", label: "vars" },
        { value: "envFile", label: "envFile" }
      ]
    })
  ) as "vars" | "envFile";

  if (editChoice === "envFile") {
    const useFile = await inputConfirm("Link an .env file?", Boolean(env.envFile));
    env.envFile = useFile ? await inputText("Path to env file", env.envFile ?? ".env") : undefined;
  } else {
    if (!env.vars) {
      env.vars = {};
    }

    const varKeys = Object.keys(env.vars);
    const action =
      varKeys.length > 0
        ? (unwrap(
            await select({
              message: "Variable action",
              options: [
                { value: "add", label: "add" },
                { value: "update", label: "update" },
                { value: "delete", label: "delete" }
              ]
            })
          ) as "add" | "update" | "delete")
        : "add";

    if (action === "delete" && varKeys.length > 0) {
      const key = unwrap(
        await select({
          message: "Delete which variable?",
          options: varKeys.map((name) => ({ value: name, label: name }))
        })
      ) as string;
      delete env.vars[key];
      console.log(pc.green(`Variable '${key}' deleted.`));
    } else if (action === "update" && varKeys.length > 0) {
      const key = unwrap(
        await select({
          message: "Update which variable?",
          options: varKeys.map((name) => ({ value: name, label: name }))
        })
      ) as string;
      const value = await inputText("New value", env.vars[key]);
      env.vars[key] = value;
      console.log(pc.green(`Variable '${key}' updated.`));
    } else {
      env.vars = await collectVars(env.vars);
    }
  }

  await writeConfig(cwd, config);
  await syncRuntimeEnvFromConfig(cwd, config);
  outro(pc.green(`Environment '${selectedEnv}' updated successfully.`));
}

async function handleRemove(cwd: string, config: LoadedConfig, envNameArg?: string): Promise<void> {
  const envNames = Object.keys(config.environments);

  if (envNames.length === 0) {
    console.log(pc.yellow("No environments to remove."));
    return;
  }

  const selectedEnv =
    envNameArg ?? (await chooseEnv(envNames, "Select environment to remove", config.defaultEnvironment));

  if (!config.environments[selectedEnv]) {
    throw new Error(`Environment '${selectedEnv}' does not exist.`);
  }

  if (selectedEnv === config.defaultEnvironment && envNames.length > 1) {
    throw new Error(
      `Cannot remove default environment '${selectedEnv}'. Set another default first using 'rnbuild env set-default'.`
    );
  }

  const shouldRemove = await inputConfirm(
    `Remove environment '${selectedEnv}'? This cannot be undone.`
  );

  if (!shouldRemove) {
    outro(pc.yellow("Cancelled."));
    return;
  }

  delete config.environments[selectedEnv];

  if (selectedEnv === config.defaultEnvironment) {
    const remaining = Object.keys(config.environments);
    config.defaultEnvironment = remaining[0] ?? "";
  }

  await writeConfig(cwd, config);
  await syncRuntimeEnvFromConfig(cwd, config);
  outro(pc.green(`Environment '${selectedEnv}' removed.`));
}

async function handleSetDefault(cwd: string, config: LoadedConfig, envNameArg?: string): Promise<void> {
  const envNames = Object.keys(config.environments);
  if (envNames.length === 0) {
    throw new Error("No environments configured. Add one first.");
  }

  const selectedEnv =
    envNameArg ??
    (await chooseEnv(envNames, "Select default environment", config.defaultEnvironment || envNames[0]));

  if (!config.environments[selectedEnv]) {
    throw new Error(`Environment '${selectedEnv}' does not exist.`);
  }

  config.defaultEnvironment = selectedEnv;
  await writeConfig(cwd, config);
  await syncRuntimeEnvFromConfig(cwd, config);
  outro(pc.green(`Default environment set to '${selectedEnv}'.`));
}

async function handleDetect(cwd: string, config: LoadedConfig): Promise<void> {
  const detected = await detectEnvironmentsFromDotEnv(cwd);
  const names = Object.keys(detected);

  if (names.length === 0) {
    console.log(pc.yellow("No .env files detected in project root."));
    return;
  }

  intro(pc.bold(pc.cyan("Detected Environments")));
  const table = createTable(["Environment", "Env File", "Variables", "Existing"]);
  for (const name of names) {
    const detectedEnv = detected[name];
    table.push([
      name,
      detectedEnv.envFile ?? pc.dim("-"),
      String(Object.keys(detectedEnv.vars ?? {}).length),
      config.environments[name] ? pc.yellow("overwrite") : pc.green("new")
    ]);
  }
  console.log(table.toString());

  const shouldImport = await inputConfirm("Import detected environments into config?", true);
  if (!shouldImport) {
    outro(pc.yellow("Cancelled."));
    return;
  }

  for (const [name, envConfig] of Object.entries(detected)) {
    config.environments[name] = envConfig;
  }

  if (!config.defaultEnvironment || !config.environments[config.defaultEnvironment]) {
    config.defaultEnvironment = names[0];
  }

  await writeConfig(cwd, config);
  await syncRuntimeEnvFromConfig(cwd, config);
  outro(pc.green("Imported detected environments into .rnbuildrc.yml."));
}
