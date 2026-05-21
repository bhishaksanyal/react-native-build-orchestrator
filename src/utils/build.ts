import type { BuildType, AndroidArtifact } from "../types.js";

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
