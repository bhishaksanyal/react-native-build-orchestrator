import path from "node:path";
import fs from "fs-extra";

import type { FlavorPlatformConfig } from "../types.js";

function extractNamedBlock(contents: string, blockName: string): string | undefined {
  const keywordIndex = contents.indexOf(blockName);
  if (keywordIndex === -1) {
    return undefined;
  }

  const braceStart = contents.indexOf("{", keywordIndex);
  if (braceStart === -1) {
    return undefined;
  }

  let depth = 0;
  for (let index = braceStart; index < contents.length; index += 1) {
    const char = contents[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return contents.slice(braceStart + 1, index);
      }
    }
  }

  return undefined;
}

function uniqueSorted(values: string[], preferred?: string): string[] {
  const deduped = Array.from(new Set(values.filter(Boolean)));
  deduped.sort((left, right) => left.localeCompare(right));

  if (preferred && deduped.includes(preferred)) {
    return [preferred, ...deduped.filter((value) => value !== preferred)];
  }

  return deduped;
}

export async function detectAndroidFlavors(projectDir: string): Promise<FlavorPlatformConfig | undefined> {
  const candidates = [
    path.join(projectDir, "android", "app", "build.gradle"),
    path.join(projectDir, "android", "app", "build.gradle.kts")
  ];

  for (const candidate of candidates) {
    if (!(await fs.pathExists(candidate))) {
      continue;
    }

    const raw = await fs.readFile(candidate, "utf8");
    const flavorsBlock = extractNamedBlock(raw, "productFlavors");
    if (!flavorsBlock) {
      continue;
    }

    const matches = [
      ...flavorsBlock.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\{/gm),
      ...flavorsBlock.matchAll(/create\s*\(\s*["']([^"']+)["']\s*\)\s*\{/gm)
    ];

    const detected = uniqueSorted(matches.map((match) => match[1]), "flavorDefault");
    if (detected.length > 0) {
      return {
        options: detected,
        default: detected[0]
      };
    }
  }

  return undefined;
}

async function collectFiles(dirPath: string, predicate: (fileName: string) => boolean): Promise<string[]> {
  const results: string[] = [];

  if (!(await fs.pathExists(dirPath))) {
    return results;
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "Pods" || entry.name === "build") {
        continue;
      }
      results.push(...(await collectFiles(entryPath, predicate)));
      continue;
    }

    if (predicate(entry.name)) {
      results.push(entryPath);
    }
  }

  return results;
}

export async function detectIosSchemes(
  projectDir: string,
  projectName?: string
): Promise<FlavorPlatformConfig | undefined> {
  const iosDir = path.join(projectDir, "ios");
  if (!(await fs.pathExists(iosDir))) {
    return undefined;
  }

  const schemeFiles = await collectFiles(iosDir, (fileName) => fileName.endsWith(".xcscheme"));
  const schemeNames = uniqueSorted(
    schemeFiles.map((filePath) => path.basename(filePath, ".xcscheme")),
    projectName
  );

  if (schemeNames.length > 0) {
    return {
      options: schemeNames,
      default: schemeNames[0]
    };
  }

  const xcodeProjects = await collectFiles(iosDir, (fileName) => fileName.endsWith(".xcodeproj"));
  const projectNames = uniqueSorted(
    xcodeProjects.map((filePath) => path.basename(filePath, ".xcodeproj")),
    projectName
  );

  if (projectNames.length > 0) {
    return {
      options: projectNames,
      default: projectNames[0]
    };
  }

  return undefined;
}