import {
  BUILD_TYPES,
  PLATFORMS,
  type AndroidArtifact,
  type BuildType,
  type Platform
} from "../types.js";

export function resolveFlavorValue(
  commandMap: Record<string, string> | undefined,
  selectedFlavor: string | undefined
): string {
  if (!selectedFlavor) return "";
  return commandMap?.[selectedFlavor] ?? selectedFlavor;
}

export function toFlavorTaskName(flavor: string): string {
  return flavor
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

const ANDROID_ARTIFACTS: AndroidArtifact[] = ["apk", "bundle"];

export function asAndroidArtifact(input: string): AndroidArtifact {
  if (!ANDROID_ARTIFACTS.includes(input as AndroidArtifact)) {
    throw new Error(`Invalid Android artifact '${input}'. Use: ${ANDROID_ARTIFACTS.join(", ")}`);
  }
  return input as AndroidArtifact;
}

export function asBuildType(input: string): BuildType {
  if (!BUILD_TYPES.includes(input as BuildType)) {
    throw new Error(`Invalid build type '${input}'. Use: ${BUILD_TYPES.join(", ")}`);
  }
  return input as BuildType;
}

export function asPlatform(input: string): Platform {
  if (!PLATFORMS.includes(input as Platform)) {
    throw new Error(`Invalid platform '${input}'. Use: ${PLATFORMS.join(", ")}`);
  }
  return input as Platform;
}

export function resolveAndroidOutputHint(
  outputHint: string | undefined,
  buildType: BuildType,
  artifact: AndroidArtifact
): string | undefined {
  if (!outputHint || buildType === "development") {
    return outputHint;
  }

  if (artifact === "apk") {
    return outputHint
      .replace("/outputs/bundle/", "/outputs/apk/")
      .replace(/\.aab$/i, ".apk")
      .replace("app-release.aab", "app-release.apk");
  }

  return outputHint
    .replace("/outputs/apk/", "/outputs/bundle/")
    .replace(/\.apk$/i, ".aab")
    .replace("app-release.apk", "app-release.aab");
}
