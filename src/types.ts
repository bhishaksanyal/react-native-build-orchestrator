export const BUILD_TYPES = ["development", "adhoc", "store"] as const;
export const PLATFORMS = ["android", "ios"] as const;

export type BuildType = (typeof BUILD_TYPES)[number];
export type Platform = (typeof PLATFORMS)[number];
export type AndroidArtifact = "apk" | "bundle";

export interface EnvironmentConfig {
  envFile?: string;
  vars?: Record<string, string>;
}

export interface FlavorPlatformConfig {
  default?: string;
  options: string[];
  commandMap?: Record<string, string>;
}

export interface FlavorConfig {
  android?: FlavorPlatformConfig;
  ios?: FlavorPlatformConfig;
}

export interface BuildTargetConfig {
  enabled: boolean;
  command: string;
  outputHint?: string;
  androidArtifact?: AndroidArtifact;
}

export interface BuildProfile {
  android?: BuildTargetConfig;
  ios?: BuildTargetConfig;
}

export interface FastlaneAndroidConfig {
  lane?: string;
  defaultTrack?: string;
  packageName?: string;
}

export interface FastlaneIosConfig {
  lane?: string;
  defaultTrack?: string;
  appIdentifier?: string;
  appleId?: string;
  teamId?: string;
}

export interface FastlaneConfig {
  android?: FastlaneAndroidConfig;
  ios?: FastlaneIosConfig;
}

export interface RNBuildConfig {
  projectName: string;
  defaultEnvironment: string;
  environments: Record<string, EnvironmentConfig>;
  flavors?: FlavorConfig;
  fastlane?: FastlaneConfig;
  builds: Record<BuildType, BuildProfile>;
}
