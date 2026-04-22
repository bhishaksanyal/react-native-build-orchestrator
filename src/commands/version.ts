import path from "node:path";
import fs from "fs-extra";
import { intro, isCancel, outro, select, text } from "@clack/prompts";
import pc from "picocolors";

import { loadConfig } from "../utils/config.js";
import { PLATFORMS, type Platform } from "../types.js"; // PLATFORMS used for asPlatform guard

interface VersionOptions {
  platform?: string;
  flavor?: string;
  allFlavors?: boolean;
  version?: string;
  /** Android versionCode */
  androidBuildNumber?: string;
  /** iOS CURRENT_PROJECT_VERSION */
  iosBuildNumber?: string;
  cwd?: string;
}

const CANCELLED = "cancelled-by-user";

function unwrap<T>(value: T | symbol): T {
  if (isCancel(value)) {
    throw new Error(CANCELLED);
  }
  return value;
}

function asPlatform(input: string): Platform {
  if (!PLATFORMS.includes(input as Platform)) {
    throw new Error(`Invalid platform '${input}'. Use: ${PLATFORMS.join(", ")}`);
  }
  return input as Platform;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveFlavorValue(
  commandMap: Record<string, string> | undefined,
  selectedFlavor: string | undefined
): string {
  if (!selectedFlavor) return "";
  return commandMap?.[selectedFlavor] ?? selectedFlavor;
}

function toAbsoluteFromCwd(cwd: string, value: string): string {
  return path.isAbsolute(value) ? value : path.join(cwd, value);
}

// ─── Android helpers ──────────────────────────────────────────────────────────

function findBlockRange(
  content: string,
  token: string
): { start: number; end: number } | null {
  const tokenIndex = content.indexOf(token);
  if (tokenIndex === -1) return null;
  const openBraceIndex = content.indexOf("{", tokenIndex + token.length);
  if (openBraceIndex === -1) return null;
  let depth = 0;
  for (let i = openBraceIndex; i < content.length; i += 1) {
    if (content[i] === "{") depth += 1;
    else if (content[i] === "}") {
      depth -= 1;
      if (depth === 0) return { start: tokenIndex, end: i + 1 };
    }
  }
  return null;
}

function findFlavorBlockRange(
  content: string,
  flavorValue: string
): { start: number; end: number } | null {
  const productFlavors = findBlockRange(content, "productFlavors");
  if (!productFlavors) return null;
  const scope = content.slice(productFlavors.start, productFlavors.end);
  const escaped = escapeRegExp(flavorValue);
  const patterns = [
    new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{`, "m"),
    new RegExp(`(^|\\n)\\s*create\\(\\s*["']${escaped}["']\\s*\\)\\s*\\{`, "m"),
    new RegExp(`(^|\\n)\\s*getByName\\(\\s*["']${escaped}["']\\s*\\)\\s*\\{`, "m"),
    new RegExp(`(^|\\n)\\s*maybeCreate\\(\\s*["']${escaped}["']\\s*\\)\\s*\\{`, "m")
  ];
  let relativeStart = -1;
  for (const pattern of patterns) {
    const match = scope.match(pattern);
    if (match && typeof match.index === "number") {
      relativeStart = match.index + match[1].length;
      break;
    }
  }
  if (relativeStart === -1) return null;
  const absoluteStart = productFlavors.start + relativeStart;
  const absoluteOpenBrace = content.indexOf("{", absoluteStart);
  if (absoluteOpenBrace === -1) return null;
  let depth = 0;
  for (let i = absoluteOpenBrace; i < content.length; i += 1) {
    if (content[i] === "{") depth += 1;
    else if (content[i] === "}") {
      depth -= 1;
      if (depth === 0) return { start: absoluteStart, end: i + 1 };
    }
  }
  return null;
}

function updateGradleProperty(params: {
  block: string;
  propertyName: "versionCode" | "versionName";
  valueLiteral: string;
  kotlinDsl: boolean;
}): string {
  const { propertyName, valueLiteral, kotlinDsl } = params;
  const assignmentRegex = new RegExp(
    `(^\\s*${propertyName}\\s*(?:=\\s*)?)([^\\n]+)$`,
    "m"
  );
  if (assignmentRegex.test(params.block)) {
    return params.block.replace(assignmentRegex, `$1${valueLiteral}`);
  }
  const closingIndex = params.block.lastIndexOf("}");
  if (closingIndex === -1) return params.block;
  const headerMatch = params.block.match(/^([ \t]*)[^\n]*\{/);
  const baseIndent = headerMatch?.[1] ?? "";
  const line = kotlinDsl
    ? `${baseIndent}    ${propertyName} = ${valueLiteral}\n`
    : `${baseIndent}    ${propertyName} ${valueLiteral}\n`;
  return `${params.block.slice(0, closingIndex)}${line}${params.block.slice(closingIndex)}`;
}

async function resolveGradleFile(
  projectDir: string
): Promise<{ filePath: string; kotlinDsl: boolean }> {
  const gradleGroovy = path.join(projectDir, "android", "app", "build.gradle");
  const gradleKts = path.join(projectDir, "android", "app", "build.gradle.kts");
  if (await fs.pathExists(gradleGroovy)) return { filePath: gradleGroovy, kotlinDsl: false };
  if (await fs.pathExists(gradleKts)) return { filePath: gradleKts, kotlinDsl: true };
  throw new Error("Could not find android/app/build.gradle or build.gradle.kts");
}

/**
 * Updates Android version fields.
 * - versionName: ALWAYS updated in defaultConfig (version is global across all flavors)
 * - versionCode: updated in the flavor block if a flavorValue is given, else defaultConfig
 */
async function updateAndroidVersions(params: {
  projectDir: string;
  flavorValue?: string;
  version?: string;
  buildNumber?: string;
}): Promise<{ filePath: string; buildTarget: string }> {
  const { filePath, kotlinDsl } = await resolveGradleFile(params.projectDir);
  let content = await fs.readFile(filePath, "utf8");

  // versionName → always defaultConfig, regardless of flavor
  if (params.version) {
    const range = findBlockRange(content, "defaultConfig");
    if (!range) throw new Error("Could not find defaultConfig block in Android Gradle file");
    let block = content.slice(range.start, range.end);
    block = updateGradleProperty({
      block,
      propertyName: "versionName",
      valueLiteral: `"${params.version}"`,
      kotlinDsl
    });
    content = `${content.slice(0, range.start)}${block}${content.slice(range.end)}`;
  }

  // versionCode → specific flavor block or defaultConfig
  let buildTarget = "defaultConfig";
  if (params.buildNumber) {
    if (params.flavorValue) {
      const range = findFlavorBlockRange(content, params.flavorValue);
      if (!range) {
        throw new Error(
          `Could not find product flavor block for '${params.flavorValue}' in ${path.relative(params.projectDir, filePath)}`
        );
      }
      let block = content.slice(range.start, range.end);
      block = updateGradleProperty({
        block,
        propertyName: "versionCode",
        valueLiteral: String(Number(params.buildNumber)),
        kotlinDsl
      });
      content = `${content.slice(0, range.start)}${block}${content.slice(range.end)}`;
      buildTarget = `flavor '${params.flavorValue}'`;
    } else {
      const range = findBlockRange(content, "defaultConfig");
      if (!range) throw new Error("Could not find defaultConfig block in Android Gradle file");
      let block = content.slice(range.start, range.end);
      block = updateGradleProperty({
        block,
        propertyName: "versionCode",
        valueLiteral: String(Number(params.buildNumber)),
        kotlinDsl
      });
      content = `${content.slice(0, range.start)}${block}${content.slice(range.end)}`;
    }
  }

  await fs.writeFile(filePath, content, "utf8");
  return { filePath, buildTarget };
}

// ─── iOS helpers (project.pbxproj) ───────────────────────────────────────────

async function findPbxprojPath(projectDir: string): Promise<string> {
  const iosDir = path.join(projectDir, "ios");
  if (!(await fs.pathExists(iosDir))) throw new Error("ios/ directory not found.");
  const entries = await fs.readdir(iosDir);
  const xcodeprojDir = entries.find((e) => e.endsWith(".xcodeproj"));
  if (!xcodeprojDir) throw new Error("No .xcodeproj directory found in ios/");
  const pbxprojPath = path.join(iosDir, xcodeprojDir, "project.pbxproj");
  if (!(await fs.pathExists(pbxprojPath))) {
    throw new Error(`project.pbxproj not found at ${pbxprojPath}`);
  }
  return pbxprojPath;
}

/**
 * Returns the XCBuildConfiguration UUIDs that belong to a named PBXNativeTarget.
 */
function findTargetConfigUUIDs(content: string, targetName: string): string[] {
  const escaped = escapeRegExp(targetName);
  const listPattern = new RegExp(
    `[A-Fa-f0-9]{24}\\s*/\\*\\s*Build configuration list for PBXNativeTarget\\s+"${escaped}"\\s*\\*/\\s*=\\s*\\{[^}]*buildConfigurations\\s*=\\s*\\(([^)]+)\\)`,
    "si"
  );
  const match = content.match(listPattern);
  if (!match) return [];
  const uuidExtract = /([A-Fa-f0-9]{24})\s*\/\*/g;
  const uuids: string[] = [];
  let m;
  while ((m = uuidExtract.exec(match[1])) !== null) {
    uuids.push(m[1]);
  }
  return uuids;
}

function patchBuildSetting(blockContent: string, key: string, value: string): string {
  const regex = new RegExp(`(\\b${escapeRegExp(key)}\\s*=\\s*)[^;]+;`);
  if (regex.test(blockContent)) {
    return blockContent.replace(regex, `$1${value};`);
  }
  const closingIndex = blockContent.lastIndexOf("}");
  if (closingIndex === -1) return blockContent;
  return `${blockContent.slice(0, closingIndex)}\t\t\t\t${key} = ${value};\n${blockContent.slice(closingIndex)}`;
}

function patchPbxprojForUUIDs(
  content: string,
  uuids: string[],
  key: string,
  value: string
): string {
  let updated = content;
  for (const uuid of uuids) {
    const uuidEsc = escapeRegExp(uuid);
    // Match XCBuildConfiguration block: UUID /* name */ = { ... buildSettings = { INTERIOR } ... }
    const blockPattern = new RegExp(
      `(${uuidEsc}\\s*/\\*[^*]*\\*/\\s*=\\s*\\{(?:(?!buildSettings)[^}]|\\{[^}]*\\})*buildSettings\\s*=\\s*\\{)([^}]+)(\\})`,
      "si"
    );
    updated = updated.replace(blockPattern, (_, before, settings, closing) => {
      return `${before}${patchBuildSetting(settings, key, value)}${closing}`;
    });
  }
  return updated;
}

/**
 * Updates iOS version fields directly in project.pbxproj.
 * - MARKETING_VERSION: ALWAYS global (all occurrences replaced) — version must be consistent
 * - CURRENT_PROJECT_VERSION: per-target if targetName given, global otherwise
 */
async function updateIosVersions(params: {
  projectDir: string;
  targetName?: string;
  version?: string;
  buildNumber?: string;
}): Promise<{ pbxprojPath: string; buildTarget: string }> {
  const pbxprojPath = await findPbxprojPath(params.projectDir);
  let content = await fs.readFile(pbxprojPath, "utf8");

  if (params.version) {
    if (!/\bMARKETING_VERSION\s*=/.test(content)) {
      throw new Error(
        "MARKETING_VERSION not found in project.pbxproj. " +
          "Ensure your project uses MARKETING_VERSION (Xcode 11+)."
      );
    }
    content = content.replace(
      /\bMARKETING_VERSION\s*=\s*[^;]+;/g,
      `MARKETING_VERSION = ${params.version};`
    );
  }

  let buildTarget = "all targets";
  if (params.buildNumber) {
    if (params.targetName) {
      const uuids = findTargetConfigUUIDs(content, params.targetName);
      if (uuids.length === 0) {
        throw new Error(
          `Could not find build configurations for target '${params.targetName}' in project.pbxproj`
        );
      }
      content = patchPbxprojForUUIDs(content, uuids, "CURRENT_PROJECT_VERSION", params.buildNumber);
      buildTarget = `target '${params.targetName}'`;
    } else {
      if (!/\bCURRENT_PROJECT_VERSION\s*=/.test(content)) {
        throw new Error("CURRENT_PROJECT_VERSION not found in project.pbxproj.");
      }
      content = content.replace(
        /\bCURRENT_PROJECT_VERSION\s*=\s*[^;]+;/g,
        `CURRENT_PROJECT_VERSION = ${params.buildNumber};`
      );
    }
  }

  await fs.writeFile(pbxprojPath, content, "utf8");
  return { pbxprojPath, buildTarget };
}

// ─── Current-value readers (for prompt pre-fill) ────────────────────────────

function readGradleValue(block: string, propertyName: string): string | undefined {
  const regex = new RegExp(
    `${escapeRegExp(propertyName)}\\s*(?:=\\s*)?["']?([^"'\\n]+?)["']?\\s*$`,
    "m"
  );
  const raw = block.match(regex)?.[1]?.trim();
  return raw?.replace(/^"|"$/g, "");
}

async function readCurrentAndroidVersions(
  projectDir: string
): Promise<{ version?: string; buildNumber?: string }> {
  try {
    const { filePath } = await resolveGradleFile(projectDir);
    const content = await fs.readFile(filePath, "utf8");
    const range = findBlockRange(content, "defaultConfig");
    if (!range) return {};
    const block = content.slice(range.start, range.end);
    return {
      version: readGradleValue(block, "versionName"),
      buildNumber: readGradleValue(block, "versionCode")
    };
  } catch {
    return {};
  }
}

async function readCurrentIosVersions(
  projectDir: string
): Promise<{ version?: string; buildNumber?: string }> {
  try {
    const pbxprojPath = await findPbxprojPath(projectDir);
    const content = await fs.readFile(pbxprojPath, "utf8");
    return {
      version: content.match(/\bMARKETING_VERSION\s*=\s*([^;]+);/)?.[1]?.trim(),
      buildNumber: content.match(/\bCURRENT_PROJECT_VERSION\s*=\s*([^;]+);/)?.[1]?.trim()
    };
  } catch {
    return {};
  }
}

// ─── package.json helper ──────────────────────────────────────────────────────

async function updatePackageJsonVersion(
  projectDir: string,
  version: string
): Promise<string> {
  const pkgPath = path.join(projectDir, "package.json");
  if (!(await fs.pathExists(pkgPath))) {
    throw new Error("package.json not found in project root.");
  }
  const raw = await fs.readFile(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as Record<string, unknown>;
  pkg["version"] = version;
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  return pkgPath;
}

// ─── Main command ─────────────────────────────────────────────────────────────

export async function runVersionCommand(options: VersionOptions): Promise<void> {
  const projectDir = options.cwd ? toAbsoluteFromCwd(process.cwd(), options.cwd) : process.cwd();
  const config = await loadConfig(projectDir);

  if (options.allFlavors && options.flavor) {
    throw new Error("Use either --flavor or --all-flavors, not both.");
  }

  // --platform restricts to one platform (CI/scripted). Interactive always applies both.
  const platformsToUpdate: Platform[] = options.platform
    ? [asPlatform(options.platform)]
    : ["android", "ios"];

  try {
    // Read current values for prompt pre-fill
    const currentAndroid = await readCurrentAndroidVersions(projectDir);
    const currentIos     = await readCurrentIosVersions(projectDir);

    intro(pc.bold(pc.cyan("RN Build Helper  ·  Version Update")));
    console.log(pc.gray(`Project:   ${projectDir}`));
    console.log(pc.gray(`Platforms: ${platformsToUpdate.join(" + ")}`));
    console.log("");

    // ── Version — common across both platforms ────────────────────────────
    const version = options.version
      ?? String(
          unwrap(
            await text({
              message: "Version  (applied to all platforms/targets)",
              initialValue: currentAndroid.version ?? "",
              placeholder: "1.5.0"
            })
          )
        ).trim();

    // ── Build numbers — separate per platform ─────────────────────────────
    const androidBuildNumber = options.androidBuildNumber
      ?? String(
          unwrap(
            await text({
              message: "Android build number  (versionCode, integer)",
              initialValue: currentAndroid.buildNumber ?? "",
              placeholder: "150"
            })
          )
        ).trim();

    const iosBuildNumber = options.iosBuildNumber
      ?? String(
          unwrap(
            await text({
              message: "iOS build number  (CURRENT_PROJECT_VERSION, integer)",
              initialValue: currentIos.buildNumber ?? "",
              placeholder: "150"
            })
          )
        ).trim();

    if (!version && !androidBuildNumber && !iosBuildNumber) {
      throw new Error("At least one value must be provided.");
    }
    if (androidBuildNumber && !/^\d+$/.test(androidBuildNumber)) {
      throw new Error("Android build number must be a positive integer.");
    }
    if (iosBuildNumber && !/^\d+$/.test(iosBuildNumber)) {
      throw new Error("iOS build number must be a positive integer.");
    }

    // ── Flavor scope — asked per platform, only when that platform's build number is set ──
    const androidFlavorConfig = config.flavors?.["android"];
    const iosFlavorConfig     = config.flavors?.["ios"];

    let androidFlavorTarget: string | undefined;
    let allAndroidFlavors = Boolean(options.allFlavors);

    let iosFlavorTarget: string | undefined;
    let allIosFlavors = Boolean(options.allFlavors);

    if (androidBuildNumber && platformsToUpdate.includes("android") && androidFlavorConfig && !options.flavor && !options.allFlavors) {
      const scopeOpts: Array<{ value: "all" | "single"; label: string }> = [
        { value: "all",    label: "All Android flavors" },
        { value: "single", label: "Single Android flavor" }
      ];
      allAndroidFlavors = (unwrap(await select({ message: "Android build number target?", options: scopeOpts })) as string) === "all";
    }

    if (androidBuildNumber && platformsToUpdate.includes("android") && androidFlavorConfig && !allAndroidFlavors) {
      const key = options.flavor
        ? options.flavor
        : (unwrap(
            await select({
              message: "Choose Android flavor for build number",
              options: androidFlavorConfig.options.map((n) => ({ value: n, label: n })),
              initialValue: androidFlavorConfig.default ?? androidFlavorConfig.options[0]
            })
          ) as string);
      if (!androidFlavorConfig.options.includes(key)) {
        throw new Error(`Android flavor '${key}' is not configured.`);
      }
      androidFlavorTarget = resolveFlavorValue(androidFlavorConfig.commandMap, key);
    }

    if (iosBuildNumber && platformsToUpdate.includes("ios") && iosFlavorConfig && !options.flavor && !options.allFlavors) {
      const scopeOpts: Array<{ value: "all" | "single"; label: string }> = [
        { value: "all",    label: "All iOS schemes" },
        { value: "single", label: "Single iOS scheme" }
      ];
      allIosFlavors = (unwrap(await select({ message: "iOS build number target?", options: scopeOpts })) as string) === "all";
    }

    if (iosBuildNumber && platformsToUpdate.includes("ios") && iosFlavorConfig && !allIosFlavors) {
      const key = options.flavor
        ? options.flavor
        : (unwrap(
            await select({
              message: "Choose iOS scheme for build number",
              options: iosFlavorConfig.options.map((n) => ({ value: n, label: n })),
              initialValue: iosFlavorConfig.default ?? iosFlavorConfig.options[0]
            })
          ) as string);
      if (!iosFlavorConfig.options.includes(key)) {
        throw new Error(`iOS scheme '${key}' is not configured.`);
      }
      iosFlavorTarget = resolveFlavorValue(iosFlavorConfig.commandMap, key);
    }

    console.log("");

    // ── Execute: Android ──────────────────────────────────────────────────
    if (platformsToUpdate.includes("android")) {
      if (allAndroidFlavors && androidBuildNumber && androidFlavorConfig?.options.length) {
        const resolvedValues = Array.from(
          new Set(androidFlavorConfig.options.map((n) => resolveFlavorValue(androidFlavorConfig.commandMap, n)))
        );
        if (version) {
          const r = await updateAndroidVersions({ projectDir, version });
          console.log(pc.green(`Android  versionName (defaultConfig) → ${path.relative(projectDir, r.filePath)}`));
        }
        for (const fv of resolvedValues) {
          const r = await updateAndroidVersions({ projectDir, flavorValue: fv, buildNumber: androidBuildNumber });
          console.log(pc.green(`Android  versionCode (${r.buildTarget}) → ${path.relative(projectDir, r.filePath)}`));
        }
      } else {
        const r = await updateAndroidVersions({
          projectDir,
          flavorValue: androidFlavorTarget,
          version: version || undefined,
          buildNumber: androidBuildNumber || undefined
        });
        if (version)             console.log(pc.green(`Android  versionName (defaultConfig) → ${path.relative(projectDir, r.filePath)}`));
        if (androidBuildNumber)  console.log(pc.green(`Android  versionCode (${r.buildTarget}) → ${path.relative(projectDir, r.filePath)}`));
      }
    }

    // ── Execute: iOS ──────────────────────────────────────────────────────
    if (platformsToUpdate.includes("ios")) {
      if (allIosFlavors && iosBuildNumber && iosFlavorConfig?.options.length) {
        const resolvedSchemes = Array.from(
          new Set(iosFlavorConfig.options.map((n) => resolveFlavorValue(iosFlavorConfig.commandMap, n)))
        );
        if (version) {
          const r = await updateIosVersions({ projectDir, version });
          console.log(pc.green(`iOS  MARKETING_VERSION (all targets) → ${path.relative(projectDir, r.pbxprojPath)}`));
        }
        for (const scheme of resolvedSchemes) {
          const r = await updateIosVersions({ projectDir, targetName: scheme, buildNumber: iosBuildNumber });
          console.log(pc.green(`iOS  CURRENT_PROJECT_VERSION (${r.buildTarget}) → ${path.relative(projectDir, r.pbxprojPath)}`));
        }
      } else {
        const r = await updateIosVersions({
          projectDir,
          targetName: iosFlavorTarget,
          version: version || undefined,
          buildNumber: iosBuildNumber || undefined
        });
        if (version)        console.log(pc.green(`iOS  MARKETING_VERSION (all targets) → ${path.relative(projectDir, r.pbxprojPath)}`));
        if (iosBuildNumber) console.log(pc.green(`iOS  CURRENT_PROJECT_VERSION (${r.buildTarget}) → ${path.relative(projectDir, r.pbxprojPath)}`));

          // ── Execute: package.json ─────────────────────────────────────────────
          if (version) {
            const pkgPath = await updatePackageJsonVersion(projectDir, version);
            console.log(pc.green(`package.json  version → ${path.relative(projectDir, pkgPath)}`));
          }
      }
    }

    outro(pc.bold(pc.green("Done.")));
  } catch (error) {
    if (error instanceof Error && error.message === CANCELLED) {
      outro(pc.yellow("Version update cancelled."));
      return;
    }
    throw error;
  }
}
