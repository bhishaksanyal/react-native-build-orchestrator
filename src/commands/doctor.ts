import path from "node:path";
import fs from "fs-extra";
import pc from "picocolors";
import { execa } from "execa";
import { intro, outro, log } from "../utils/logger.js";
import { createTable } from "../utils/ui.js";
import { loadConfig } from "../utils/config.js";
import type { DoctorSummary } from "../types.js";

// ── Types ──────────────────────────────────────────────────────

interface DoctorChecks {
  packageJson: boolean;
  android: boolean;
  ios: boolean;
  config: boolean;
  ruby: boolean;
  bundler: boolean;
  fastlaneCli: boolean;
  gemfile: boolean;
  fastlaneDir: boolean;
  fastlaneConfig: boolean;
}

// ── Helpers ────────────────────────────────────────────────────

async function checkCommandExists(cmd: string): Promise<boolean> {
  try {
    await execa("which", [cmd], { reject: true });
    return true;
  } catch {
    return false;
  }
}

async function checkHasConfig(projectDir: string): Promise<boolean> {
  try {
    const config = await loadConfig(projectDir);
    return Boolean(config.fastlane?.android || config.fastlane?.ios);
  } catch {
    return false;
  }
}

async function runAllChecks(projectDir: string): Promise<DoctorChecks> {
  const [
    packageJson,
    android,
    ios,
    config,
    ruby,
    bundler,
    fastlaneCli,
    gemfile,
    fastlaneDir,
    fastlaneConfig
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
    checkHasConfig(projectDir)
  ]);

  return { packageJson, android, ios, config, ruby, bundler, fastlaneCli, gemfile, fastlaneDir, fastlaneConfig };
}

// ── Display ────────────────────────────────────────────────────

function displayDoctorTable(c: DoctorChecks): void {
  const table = createTable(["Check", "Status"]);
  table.push(["package.json", c.packageJson ? pc.green("OK") : pc.red("MISSING")]);
  table.push(["android folder", c.android ? pc.green("OK") : pc.red("MISSING")]);
  table.push(["ios folder", c.ios ? pc.green("OK") : pc.yellow("OPTIONAL")]);
  table.push([".rnbuildrc.yml", c.config ? pc.green("OK") : pc.red("MISSING")]);
  table.push([]);
  table.push(["ruby", c.ruby ? pc.green("OK") : pc.red("MISSING")]);
  table.push(["bundler", c.bundler ? pc.green("OK") : pc.red("MISSING")]);
  table.push(["fastlane (CLI)", c.fastlaneCli ? pc.green("OK") : pc.yellow("NOT FOUND")]);
  table.push(["Gemfile", c.gemfile ? pc.green("OK") : pc.yellow("MISSING")]);
  table.push(["fastlane/ dir", c.fastlaneDir ? pc.green("OK") : pc.yellow("MISSING")]);
  table.push(["fastlane config", c.fastlaneConfig ? pc.green("OK") : pc.yellow("MISSING")]);
  log(table.toString());
}

function displayTips(c: DoctorChecks): void {
  if (!c.ruby) {
    log(pc.yellow("Tip: Ruby is required for Fastlane. Install Ruby (>= 3.0) to enable store uploads."));
  }
  if (!c.bundler && c.ruby) {
    log(pc.yellow("Tip: Install Bundler (gem install bundler) and create a Gemfile for reproducible CI runs."));
  }
  if (!c.fastlaneCli && c.ruby) {
    log(pc.yellow("Tip: Install Fastlane (gem install fastlane -N) or add it to your Gemfile."));
  }
  if (!c.gemfile) {
    log(pc.yellow("Tip: Add a Gemfile with 'gem \"fastlane\"' for reproducible Fastlane runs."));
  }
  if (!c.fastlaneDir) {
    log(pc.yellow("Tip: Run 'rnbuild fastlane setup' to generate Fastfile and Appfile."));
  }
  if (!c.fastlaneConfig && !c.config) {
    log(pc.yellow("Tip: Run 'rnbuild init' to create .rnbuildrc.yml, then 'rnbuild fastlane setup'."));
  }
}

function isProjectValid(c: DoctorChecks): boolean {
  return c.config && c.packageJson && (c.android || c.ios);
}

function collectMissing(c: DoctorChecks): string[] {
  const missing: string[] = [];
  if (!c.config) missing.push(".rnbuildrc.yml");
  if (!c.packageJson) missing.push("package.json");
  if (!c.android && !c.ios) missing.push("native folders (android/ios)");
  return missing;
}

// ── Main entry point ───────────────────────────────────────────

export async function runDoctorCommand(cwd?: string): Promise<DoctorSummary> {
  const projectDir = cwd ? path.resolve(cwd) : process.cwd();
  const checks = await runAllChecks(projectDir);

  intro(pc.bold(pc.cyan("RN Build Helper Doctor")));
  displayDoctorTable(checks);
  displayTips(checks);

  if (!isProjectValid(checks)) {
    const missing = collectMissing(checks);
    const message = `Doctor checks failed: missing ${missing.join(", ")}`;
    outro(pc.red(message));
    if (!checks.config) {
      log(pc.yellow("Run 'rnbuild init' in your React Native project to generate config."));
    }
    return { status: "error", message, checks };
  }

  outro(pc.green("Doctor checks completed. Project is valid."));
  return { status: "success", checks };
}
