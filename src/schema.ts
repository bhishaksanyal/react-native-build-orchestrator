import { z } from "zod";

import type { RNBuildConfig } from "./types.js";

const buildTargetSchema = z.object({
  enabled: z.boolean(),
  command: z.string().min(1),
  outputHint: z.string().optional(),
  androidArtifact: z.enum(["apk", "bundle"]).optional()
});

const buildProfileSchema = z.object({
  android: buildTargetSchema.optional(),
  ios: buildTargetSchema.optional()
});

const environmentSchema = z.object({
  envFile: z.string().optional(),
  vars: z.record(z.string()).optional()
});

const flavorPlatformSchema = z.object({
  default: z.string().optional(),
  options: z.array(z.string().min(1)).min(1),
  commandMap: z.record(z.string()).optional()
});

const fastlaneSchema = z.object({
  android: z.object({
    lane: z.string().optional(),
    defaultTrack: z.string().optional(),
    packageName: z.string().optional()
  }).optional(),
  ios: z.object({
    lane: z.string().optional(),
    defaultTrack: z.string().optional(),
    appIdentifier: z.string().optional(),
    appleId: z.string().optional(),
    teamId: z.string().optional()
  }).optional()
}).optional();

const configSchema = z.object({
  projectName: z.string().min(1),
  defaultEnvironment: z.string().min(1),
  environments: z.record(environmentSchema),
  flavors: z.object({
    android: flavorPlatformSchema.optional(),
    ios: flavorPlatformSchema.optional()
  }).optional(),
  fastlane: fastlaneSchema,
  builds: z.object({
    development: buildProfileSchema,
    adhoc: buildProfileSchema,
    store: buildProfileSchema
  })
}).superRefine((config, ctx) => {
  if (!config.environments[config.defaultEnvironment]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaultEnvironment"],
      message: "defaultEnvironment must match a configured environment name"
    });
  }

  for (const platform of ["android", "ios"] as const) {
    const platformFlavors = config.flavors?.[platform];
    if (platformFlavors?.default && !platformFlavors.options.includes(platformFlavors.default)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["flavors", platform, "default"],
        message: `default ${platform} flavor must match one of the configured options`
      });
    }

    if (platformFlavors?.commandMap) {
      for (const key of Object.keys(platformFlavors.commandMap)) {
        if (!platformFlavors.options.includes(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["flavors", platform, "commandMap", key],
            message: `mapped ${platform} flavor must exist in options`
          });
        }
      }
    }
  }
});

export function parseConfig(input: unknown): RNBuildConfig {
  return configSchema.parse(input);
}
