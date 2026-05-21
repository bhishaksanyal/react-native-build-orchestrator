import {
  PLATFORMS,
  BUILD_TYPES,
  type Platform,
  type BuildType,
  type AndroidArtifact
} from "../types.js";

const ANDROID_ARTIFACTS: AndroidArtifact[] = ["apk", "bundle"];

export function asPlatform(input: string): Platform {
  if (!PLATFORMS.includes(input as Platform)) {
    throw new Error(`Invalid platform '${input}'. Use: ${PLATFORMS.join(", ")}`);
  }
  return input as Platform;
}

export function asBuildType(input: string): BuildType {
  if (!BUILD_TYPES.includes(input as BuildType)) {
    throw new Error(`Invalid build type '${input}'. Use: ${BUILD_TYPES.join(", ")}`);
  }
  return input as BuildType;
}

export function asAndroidArtifact(input: string): AndroidArtifact {
  if (!ANDROID_ARTIFACTS.includes(input as AndroidArtifact)) {
    throw new Error(`Invalid Android artifact '${input}'. Use: ${ANDROID_ARTIFACTS.join(", ")}`);
  }
  return input as AndroidArtifact;
}
