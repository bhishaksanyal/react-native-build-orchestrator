import path from "node:path";
import fs from "fs-extra";
import pc from "picocolors";
import { intro, outro, log } from "../utils/logger.js";
import { createTable } from "../utils/ui.js";
import type { DoctorSummary } from "../types.js";

export async function runDoctorCommand(cwd?: string): Promise<DoctorSummary> {
  const projectDir = cwd ? path.resolve(cwd) : process.cwd();

  const checks = await Promise.all([
    fs.pathExists(path.join(projectDir, "package.json")),
    fs.pathExists(path.join(projectDir, "android")),
    fs.pathExists(path.join(projectDir, "ios")),
    fs.pathExists(path.join(projectDir, ".rnbuildrc.yml"))
  ]);

  const [hasPackageJson, hasAndroid, hasIos, hasConfig] = checks;

  intro(pc.bold(pc.cyan("RN Build Helper Doctor")));

  const table = createTable(["Check", "Status"]);
  table.push(["package.json", hasPackageJson ? pc.green("OK") : pc.red("MISSING")]);
  table.push(["android folder", hasAndroid ? pc.green("OK") : pc.red("MISSING")]);
  table.push(["ios folder", hasIos ? pc.green("OK") : pc.yellow("OPTIONAL")]);
  table.push([".rnbuildrc.yml", hasConfig ? pc.green("OK") : pc.red("MISSING")]);

  log(table.toString());

  const overallSuccess = hasConfig && hasPackageJson && (hasAndroid || hasIos);

  if (!overallSuccess) {
    const missing = [];
    if (!hasConfig) missing.push(".rnbuildrc.yml");
    if (!hasPackageJson) missing.push("package.json");
    if (!hasAndroid && !hasIos) missing.push("native folders (android/ios)");

    const message = `Doctor checks failed: missing ${missing.join(", ")}`;
    outro(pc.red(message));
    if (!hasConfig) {
      log(pc.yellow("Run 'rnbuild init' in your React Native project to generate config."));
    }

    return {
      status: "error",
      message,
      checks: {
        packageJson: hasPackageJson,
        android: hasAndroid,
        ios: hasIos,
        config: hasConfig
      }
    };
  }

  outro(pc.green("Doctor checks completed. Project is valid."));

  return {
    status: "success",
    checks: {
      packageJson: hasPackageJson,
      android: hasAndroid,
      ios: hasIos,
      config: hasConfig
    }
  };
}
