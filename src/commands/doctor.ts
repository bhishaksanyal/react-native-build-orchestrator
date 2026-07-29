import path from "node:path";
import fs from "fs-extra";
import pc from "picocolors";
import { execa } from "execa";
import { intro, outro, log } from "../utils/logger.js";
import { createTable } from "../utils/ui.js";
import { loadConfig } from "../utils/config.js";
import type { DoctorSummary } from "../types.js";

async function checkCommandExists(cmd: string): Promise<boolean> {
  try {
    await execa("which", [cmd], { reject: true });
    return true;
  } catch {
    return false;
  }
}

export async function runDoctorCommand(cwd?: string): Promise<DoctorSummary> {
  const projectDir = cwd ? path.resolve(cwd) : process.cwd();

  const [
    hasPackageJson,
    hasAndroid,
    hasIos,
    hasConfig,
    hasRuby,
    hasBundler,
    hasFastlaneCli,
    hasGemfile,
    hasFastlaneDir,
    hasFastlaneConfig
  ] = await Promise.all([
    fs.pathExists(path.join(projectDir, "package.json")),
    fs.pathExists(path.join(projectDir, "android")),
    fs.pathExists(path.join(projectDir, "ios")),
    fs.pathExists(path.join(projectDir, ".rnbuildrc.yml")),
    checkCommandExists("ruby"),
    checkCommandExists("bundle"),
    checkCommandExists("fastlane"),
    fs.pathExists(path.join(projectDir, "Gemfile")),
    fs.pathExists(path.join(projectDir, "fastlane")),
    (async () => {
      try {
        const config = await loadConfig(projectDir);
        return Boolean(config.fastlane?.android || config.fastlane?.ios);
      } catch {
        return false;
      }
    })()
  ]);

  intro(pc.bold(pc.cyan("RN Build Helper Doctor")));

  const table = createTable(["Check", "Status"]);
  table.push(["package.json", hasPackageJson ? pc.green("OK") : pc.red("MISSING")]);
  table.push(["android folder", hasAndroid ? pc.green("OK") : pc.red("MISSING")]);
  table.push(["ios folder", hasIos ? pc.green("OK") : pc.yellow("OPTIONAL")]);
  table.push([".rnbuildrc.yml", hasConfig ? pc.green("OK") : pc.red("MISSING")]);
  table.push([]);
  table.push(["ruby", hasRuby ? pc.green("OK") : pc.red("MISSING")]);
  table.push(["bundler", hasBundler ? pc.green("OK") : pc.red("MISSING")]);
  table.push(["fastlane (CLI)", hasFastlaneCli ? pc.green("OK") : pc.yellow("NOT FOUND")]);
  table.push(["Gemfile", hasGemfile ? pc.green("OK") : pc.yellow("MISSING")]);
  table.push(["fastlane/ dir", hasFastlaneDir ? pc.green("OK") : pc.yellow("MISSING")]);
  table.push(["fastlane config", hasFastlaneConfig ? pc.green("OK") : pc.yellow("MISSING")]);

  log(table.toString());

  if (!hasRuby) {
    log(pc.yellow("Tip: Ruby is required for Fastlane. Install Ruby (>= 3.0) to enable store uploads."));
  }
  if (!hasBundler && hasRuby) {
    log(pc.yellow("Tip: Install Bundler (gem install bundler) and create a Gemfile for reproducible CI runs."));
  }
  if (!hasFastlaneCli && hasRuby) {
    log(pc.yellow("Tip: Install Fastlane (gem install fastlane -N) or add it to your Gemfile."));
  }
  if (!hasGemfile) {
    log(pc.yellow("Tip: Add a Gemfile with 'gem \"fastlane\"' for reproducible Fastlane runs."));
  }
  if (!hasFastlaneDir) {
    log(pc.yellow("Tip: Run 'rnbuild fastlane setup' to generate Fastfile and Appfile."));
  }
  if (!hasFastlaneConfig && !hasConfig) {
    log(pc.yellow("Tip: Run 'rnbuild init' to create .rnbuildrc.yml, then 'rnbuild fastlane setup'."));
  }

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
        config: hasConfig,
        ruby: hasRuby,
        bundler: hasBundler,
        fastlaneCli: hasFastlaneCli,
        gemfile: hasGemfile,
        fastlaneDir: hasFastlaneDir,
        fastlaneConfig: hasFastlaneConfig
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
      config: hasConfig,
      ruby: hasRuby,
      bundler: hasBundler,
      fastlaneCli: hasFastlaneCli,
      gemfile: hasGemfile,
      fastlaneDir: hasFastlaneDir,
      fastlaneConfig: hasFastlaneConfig
    }
  };
}
