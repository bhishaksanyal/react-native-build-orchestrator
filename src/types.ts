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

export interface CommandResult {
  status: "success" | "error" | "cancelled";
  message?: string;
}

export interface BuildSummary extends CommandResult {
  projectDir?: string;
  environment?: string;
  buildType?: BuildType;
  platform?: Platform;
  flavor?: string;
  command?: string;
  logPath?: string;
  dryRun?: boolean;
  expectedArtifact?: string;
}

export interface ReleaseSummary extends CommandResult {
  projectDir?: string;
  environment?: string;
  platform?: Platform;
  flavor?: string;
  buildType?: BuildType;
  upload?: {
    lane?: string;
    track?: string;
    artifactPath?: string;
  };
  dryRun?: boolean;
}

export interface DoctorSummary extends CommandResult {
  checks?: {
    packageJson: boolean;
    android: boolean;
    ios: boolean;
    config: boolean;
  };
}

export interface VersionSummary extends CommandResult {
  projectDir?: string;
  version?: string;
  androidBuildNumber?: string;
  iosBuildNumber?: string;
  platforms?: string[];
}

export interface InitSummary extends CommandResult {
  projectName?: string;
  configPath?: string;
  environments?: string[];
  platforms?: string[];
}

export interface EnvSummary extends CommandResult {
  action?: string;
  envName?: string;
}

export interface FlavorSummary extends CommandResult {
  action?: string;
  platform?: string;
  flavor?: string;
}

export interface FastlaneSummary extends CommandResult {
  fastlaneDir?: string;
  filesOverwritten?: boolean;
}
