import { confirm, intro, isCancel, outro, select, text } from "@clack/prompts";
import pc from "picocolors";

import { loadConfig, writeConfig } from "../utils/config.js";
import { detectAndroidFlavors, detectIosSchemes } from "../utils/flavor-detection.js";
import type { FlavorPlatformConfig, Platform } from "../types.js";
import { createTable } from "../utils/ui.js";

type FlavorAction = "list" | "add" | "edit" | "remove" | "set-default" | "detect";
type LoadedConfig = Awaited<ReturnType<typeof loadConfig>>;

const CANCELLED = "cancelled-by-user";

function unwrap<T>(value: T | symbol): T {
  if (isCancel(value)) {
    throw new Error(CANCELLED);
  }
  return value;
}

function ensureFlavorPlatform(config: LoadedConfig, platform: Platform): FlavorPlatformConfig {
  config.flavors ??= {};
  config.flavors[platform] ??= { options: [] };
  return config.flavors[platform] as FlavorPlatformConfig;
}

async function choosePlatform(
  message: string,
  allowedPlatforms: Platform[] = ["android", "ios"]
): Promise<Platform> {
  return unwrap(
    await select({
      message,
      options: allowedPlatforms.map((platform) => ({ value: platform, label: platform }))
    })
  ) as Platform;
}

async function chooseFlavor(
  config: FlavorPlatformConfig,
  message: string,
  initialValue?: string
): Promise<string> {
  return unwrap(
    await select({
      message,
      options: config.options.map((option) => ({ value: option, label: option })),
      initialValue
    })
  ) as string;
}

async function inputText(message: string, defaultValue?: string, placeholder?: string): Promise<string> {
  return String(unwrap(await text({ message, defaultValue, placeholder }))).trim();
}

async function inputConfirm(message: string, initialValue = false): Promise<boolean> {
  return Boolean(unwrap(await confirm({ message, initialValue })));
}

export async function runFlavorCommand(
  action?: FlavorAction,
  platformArg?: string,
  flavorArg?: string
): Promise<void> {
  const cwd = process.cwd();
  const config = await loadConfig(cwd);

  try {
    const selectedAction =
      action ??
      (unwrap(
        await select({
          message: "Flavor action",
          options: [
            { value: "list", label: "list" },
            { value: "add", label: "add" },
            { value: "edit", label: "edit" },
            { value: "remove", label: "remove" },
            { value: "set-default", label: "set-default" },
            { value: "detect", label: "detect" }
          ]
        })
      ) as FlavorAction);

    switch (selectedAction) {
      case "list":
        await handleList(config);
        break;
      case "add":
        await handleAdd(cwd, config, platformArg, flavorArg);
        break;
      case "edit":
        await handleEdit(cwd, config, platformArg, flavorArg);
        break;
      case "remove":
        await handleRemove(cwd, config, platformArg, flavorArg);
        break;
      case "set-default":
        await handleSetDefault(cwd, config, platformArg, flavorArg);
        break;
      case "detect":
        await handleDetect(cwd, config, platformArg);
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
  const platforms = (["android", "ios"] as Platform[]).filter(
    (platform) => config.flavors?.[platform]?.options.length
  );

  if (platforms.length === 0) {
    console.log(pc.yellow("No flavors configured yet. Use 'rnbuild flavor add' to create one."));
    return;
  }

  intro(pc.bold(pc.cyan("Flavor Registry")));
  const table = createTable(["Platform", "Flavor", "Default", "Command Value"]);

  for (const platform of platforms) {
    const platformConfig = config.flavors?.[platform];
    if (!platformConfig) {
      continue;
    }

    for (const flavor of platformConfig.options) {
      table.push([
        platform,
        pc.green(flavor),
        platformConfig.default === flavor ? pc.green("yes") : pc.dim("no"),
        platformConfig.commandMap?.[flavor] ?? pc.dim(flavor)
      ]);
    }
  }

  console.log(table.toString());
  outro(pc.gray("Use 'rnbuild flavor set-default <platform> <name>' to set platform defaults."));
}

async function resolvePlatform(platformArg?: string, requireExisting = false, config?: LoadedConfig): Promise<Platform> {
  if (platformArg === "android" || platformArg === "ios") {
    if (requireExisting && config && !config.flavors?.[platformArg]?.options.length) {
      throw new Error(`No ${platformArg} flavors configured.`);
    }
    return platformArg;
  }

  const allowed = requireExisting && config
    ? (["android", "ios"] as Platform[]).filter((platform) => config.flavors?.[platform]?.options.length)
    : (["android", "ios"] as Platform[]);

  if (allowed.length === 0) {
    throw new Error("No flavors configured yet. Add a flavor first.");
  }

  return choosePlatform("Choose platform", allowed);
}

async function handleAdd(
  cwd: string,
  config: LoadedConfig,
  platformArg?: string,
  flavorArg?: string
): Promise<void> {
  intro(pc.bold(pc.cyan("Add Flavor")));

  const platform = await resolvePlatform(platformArg, false, config);
  const platformConfig = ensureFlavorPlatform(config, platform);

  const flavorName = flavorArg ?? (await inputText("Flavor name", undefined, platform === "ios" ? "clientA" : "flavorDefault"));
  if (!flavorName) {
    throw new Error("Flavor name cannot be empty.");
  }
  if (platformConfig.options.includes(flavorName)) {
    throw new Error(`Flavor '${flavorName}' already exists for ${platform}.`);
  }

  const resolvedValue = await inputText(
    platform === "ios"
      ? `Scheme name for '${flavorName}'`
      : `Gradle flavor/task value for '${flavorName}'`,
    flavorName
  );

  platformConfig.options.push(flavorName);
  if (resolvedValue && resolvedValue !== flavorName) {
    platformConfig.commandMap = {
      ...(platformConfig.commandMap ?? {}),
      [flavorName]: resolvedValue
    };
  }

  if (!platformConfig.default || (await inputConfirm(`Set '${flavorName}' as default ${platform} flavor?`))) {
    platformConfig.default = flavorName;
  }

  await writeConfig(cwd, config);
  outro(pc.green(`Added ${platform} flavor '${flavorName}'.`));
}

async function handleEdit(
  cwd: string,
  config: LoadedConfig,
  platformArg?: string,
  flavorArg?: string
): Promise<void> {
  const platform = await resolvePlatform(platformArg, true, config);
  const platformConfig = ensureFlavorPlatform(config, platform);
  const flavorName = flavorArg ?? (await chooseFlavor(platformConfig, `Choose ${platform} flavor`, platformConfig.default));

  const editAction = unwrap(
    await select({
      message: "What do you want to edit?",
      options: [
        { value: "rename", label: "rename" },
        { value: "command-value", label: platform === "ios" ? "scheme mapping" : "task mapping" }
      ]
    })
  ) as "rename" | "command-value";

  if (editAction === "rename") {
    const nextName = await inputText("New flavor name", flavorName);
    if (!nextName) {
      throw new Error("Flavor name cannot be empty.");
    }
    if (nextName !== flavorName && platformConfig.options.includes(nextName)) {
      throw new Error(`Flavor '${nextName}' already exists for ${platform}.`);
    }

    platformConfig.options = platformConfig.options.map((option) => (option === flavorName ? nextName : option));
    if (platformConfig.default === flavorName) {
      platformConfig.default = nextName;
    }

    if (platformConfig.commandMap?.[flavorName]) {
      platformConfig.commandMap[nextName] = platformConfig.commandMap[flavorName];
      delete platformConfig.commandMap[flavorName];
    }
  } else {
    const mappedValue = await inputText(
      platform === "ios" ? "Scheme name" : "Gradle flavor/task value",
      platformConfig.commandMap?.[flavorName] ?? flavorName
    );

    if (!mappedValue || mappedValue === flavorName) {
      if (platformConfig.commandMap) {
        delete platformConfig.commandMap[flavorName];
        if (Object.keys(platformConfig.commandMap).length === 0) {
          delete platformConfig.commandMap;
        }
      }
    } else {
      platformConfig.commandMap = {
        ...(platformConfig.commandMap ?? {}),
        [flavorName]: mappedValue
      };
    }
  }

  await writeConfig(cwd, config);
  outro(pc.green(`Updated ${platform} flavor '${flavorName}'.`));
}

async function handleRemove(
  cwd: string,
  config: LoadedConfig,
  platformArg?: string,
  flavorArg?: string
): Promise<void> {
  const platform = await resolvePlatform(platformArg, true, config);
  const platformConfig = ensureFlavorPlatform(config, platform);
  const flavorName = flavorArg ?? (await chooseFlavor(platformConfig, `Choose ${platform} flavor to remove`, platformConfig.default));

  if (platformConfig.default === flavorName && platformConfig.options.length > 1) {
    throw new Error(
      `Cannot remove default ${platform} flavor '${flavorName}'. Set another default first.`
    );
  }

  const shouldRemove = await inputConfirm(`Remove ${platform} flavor '${flavorName}'?`);
  if (!shouldRemove) {
    outro(pc.yellow("Cancelled."));
    return;
  }

  platformConfig.options = platformConfig.options.filter((option) => option !== flavorName);
  if (platformConfig.commandMap) {
    delete platformConfig.commandMap[flavorName];
    if (Object.keys(platformConfig.commandMap).length === 0) {
      delete platformConfig.commandMap;
    }
  }

  if (platformConfig.default === flavorName) {
    platformConfig.default = platformConfig.options[0];
  }

  if (platformConfig.options.length === 0 && config.flavors) {
    delete config.flavors[platform];
    if (!config.flavors.android && !config.flavors.ios) {
      delete config.flavors;
    }
  }

  await writeConfig(cwd, config);
  outro(pc.green(`Removed ${platform} flavor '${flavorName}'.`));
}

async function handleSetDefault(
  cwd: string,
  config: LoadedConfig,
  platformArg?: string,
  flavorArg?: string
): Promise<void> {
  const platform = await resolvePlatform(platformArg, true, config);
  const platformConfig = ensureFlavorPlatform(config, platform);
  const flavorName = flavorArg ?? (await chooseFlavor(platformConfig, `Choose default ${platform} flavor`, platformConfig.default));

  platformConfig.default = flavorName;
  await writeConfig(cwd, config);
  outro(pc.green(`Default ${platform} flavor set to '${flavorName}'.`));
}

async function handleDetect(cwd: string, config: LoadedConfig, platformArg?: string): Promise<void> {
  const platform = platformArg === "android" || platformArg === "ios" ? platformArg : undefined;

  const detectedAndroid = !platform || platform === "android" ? await detectAndroidFlavors(cwd) : undefined;
  const detectedIos = !platform || platform === "ios" ? await detectIosSchemes(cwd, config.projectName) : undefined;

  if (!detectedAndroid && !detectedIos) {
    console.log(pc.yellow("No Android flavors or iOS schemes detected."));
    return;
  }

  intro(pc.bold(pc.cyan("Detected Flavors")));
  const table = createTable(["Platform", "Detected", "Default"]);

  if (detectedAndroid) {
    table.push(["android", detectedAndroid.options.join(", "), detectedAndroid.default ?? pc.dim("-")]);
  }
  if (detectedIos) {
    table.push(["ios", detectedIos.options.join(", "), detectedIos.default ?? pc.dim("-")]);
  }

  console.log(table.toString());

  const shouldImport = await inputConfirm("Import detected flavors into config?", true);
  if (!shouldImport) {
    outro(pc.yellow("Cancelled."));
    return;
  }

  if (detectedAndroid) {
    config.flavors ??= {};
    config.flavors.android = {
      ...config.flavors.android,
      ...detectedAndroid,
      commandMap: config.flavors.android?.commandMap
    };
  }

  if (detectedIos) {
    config.flavors ??= {};
    config.flavors.ios = {
      ...config.flavors.ios,
      ...detectedIos,
      commandMap: config.flavors.ios?.commandMap
    };
  }

  await writeConfig(cwd, config);
  outro(pc.green("Imported detected flavors into .rnbuildrc.yml."));
}