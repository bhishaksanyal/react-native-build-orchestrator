import path from "node:path";
import fs from "fs-extra";
import pc from "picocolors";
import { intro, outro, log } from "../utils/logger.js";
import { createTable } from "../utils/ui.js";

export async function runDoctorCommand(cwd?: string): Promise<any> {
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

  if (!hasConfig) {
    outro(pc.yellow("Run 'rnbuild init' in your React Native project to generate config."));
    return {
      status: "error",
      message: "Missing .rnbuildrc.yml"
    };
  }

  outro(pc.green("Doctor checks completed."));

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
