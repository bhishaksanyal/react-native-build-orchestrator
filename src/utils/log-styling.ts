import path from "node:path";
import pc from "picocolors";
import type { Platform } from "../types.js";

export function summarizeIosCompilerError(line: string): string | null {
  const normalized = line.replace(/\\=/g, "=");

  const sourcePath = normalized.match(/(?:^|\s)-c\s+(\/[^\s]+\.(?:m|mm|c|cc|cpp|swift))/)?.[1];
  const sourceFile = sourcePath ? path.basename(sourcePath) : undefined;

  const explicitMessage = normalized.match(/\berror:\s*(.+)$/)?.[1]?.trim();
  if (explicitMessage) {
    return sourceFile ? `${explicitMessage} (${sourceFile})` : explicitMessage;
  }

  const flagMessage = normalized.match(/\berror\s+(-[A-Za-z0-9_-]+)/)?.[1];
  if (flagMessage) {
    return sourceFile ? `${flagMessage} (${sourceFile})` : flagMessage;
  }

  const keywordMessage = normalized.match(/\berror\s+([^\s]+(?:-[^\s]+)+)/)?.[1];
  if (keywordMessage) {
    return sourceFile ? `${keywordMessage} (${sourceFile})` : keywordMessage;
  }

  return null;
}

/**
 * Common style for standard release/upload logs
 */
export function styleLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return "";
  }

  if (
    trimmed.includes("error") ||
    trimmed.includes("failed") ||
    trimmed.includes("FAIL") ||
    trimmed.includes("[!] ")
  ) {
    return pc.red(`  ${trimmed}`);
  }

  if (
    trimmed.includes("warning") ||
    trimmed.includes("deprecated") ||
    trimmed.includes("warn")
  ) {
    return pc.yellow(`  ${trimmed}`);
  }

  if (
    trimmed.includes("Uploading") ||
    trimmed.includes("Successfully") ||
    trimmed.includes("finished")
  ) {
    return pc.green(`  ${trimmed}`);
  }

  return pc.gray(`  ${trimmed}`);
}

/**
 * Detailed style for build command logs
 */
export function stylePrettyLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return "";
  }

  if (
    trimmed.includes("BUILD SUCCESSFUL") ||
    trimmed.includes("ARCHIVE SUCCEEDED") ||
    trimmed.includes("Succeeded")
  ) {
    return pc.green(`  ${trimmed}`);
  }

  if (
    trimmed.includes("BUILD FAILED") ||
    trimmed.includes("FAILED") ||
    trimmed.includes("error:") ||
    trimmed.includes("** ARCHIVE FAILED **")
  ) {
    return pc.red(`  ${trimmed}`);
  }

  if (trimmed.startsWith("> Task")) {
    return pc.cyan(`  ${trimmed}`);
  }

  if (
    trimmed.startsWith("warning:") ||
    trimmed.includes("deprecated") ||
    trimmed.includes("Deprecation")
  ) {
    return pc.yellow(`  ${trimmed}`);
  }

  if (
    trimmed.startsWith("Compile") ||
    trimmed.startsWith("Ld ") ||
    trimmed.startsWith("CodeSign") ||
    trimmed.startsWith("PhaseScriptExecution")
  ) {
    return pc.blue(`  ${trimmed}`);
  }

  return pc.gray(`  ${trimmed}`);
}

/**
 * iOS specific compiler output styling
 */
export function styleIosLine(t: string): string {
  if (!t) return "";

  // ── React Native CLI status lines ────────────────────────────────────────
  if (/^- Building the app\.{0,}$/.test(t)) return "";
  if (/^info A dev server is already running/.test(t)) return pc.gray(`  ${t}`);
  if (/^info Found Xcode workspace /.test(t)) return pc.cyan(`  ⟳ ${t.replace(/^info\s+/, "")}`);
  if (/^info Found booted /.test(t)) return pc.cyan(`  ⟳ ${t.replace(/^info\s+/, "")}`);
  if (/^info Building \(using /.test(t)) return pc.bold(pc.cyan("  ▶ Starting Xcode build"));
  if (/^info Installing /.test(t)) return pc.bold(pc.cyan(`  ⬇ ${t.replace(/^info\s+/, "")}`));
  if (/^info Launching /.test(t)) return pc.bold(pc.green(`  ▶ ${t.replace(/^info\s+/, "")}`));
  if (/^info /.test(t)) return pc.gray(`  ${t}`);

  // ── Terminal outcomes ─────────────────────────────────────────────────────
  if (/\*\* BUILD SUCCEEDED \*\*/.test(t)) return pc.bold(pc.green("  ✓ Build succeeded"));
  if (/\*\* BUILD FAILED \*\*/.test(t))    return pc.bold(pc.red("  ✗ Build failed"));

  // ── Build target header ──────────────────────────────────────────────────
  const targetM = t.match(/^=== BUILD TARGET (.+?) OF .+ WITH CONFIGURATION (.+?) ===$/);
  if (targetM) return pc.bold(pc.cyan(`  ▶ ${targetM[1]}  [${targetM[2]}]`));

  // ── Compile ──────────────────────────────────────────────────────────────
  if (/^CompileSwift\b/.test(t)) {
    const file = t.split(" ").pop()?.split("/").pop() ?? "";
    return pc.cyan(`  ⟳ Swift  ${file}`);
  }
  if (/^CompileC\b/.test(t)) {
    const file = t.split(" ").pop()?.split("/").pop() ?? "";
    return pc.cyan(`  ⟳ C/ObjC ${file}`);
  }
  if (/^SwiftDriver\b|^SwiftCompile\b|^SwiftMergeGeneratedHeaders\b/.test(t)) return "";
  if (/^SwiftEmitModule\b/.test(t)) return pc.cyan("  ⟳ Emitting Swift module");

  // ── Link / Sign ──────────────────────────────────────────────────────────
  if (/^Ld\b/.test(t)) {
    const file = t.split(" ")[1]?.split("/").pop() ?? "";
    return pc.magenta(`  ⟳ Linking ${file}`);
  }
  if (/^CodeSign\b/.test(t)) {
    const file = t.match(/CodeSign\s+(\S+)/)?.[1]?.split("/").pop() ?? "";
    return pc.blue(`  ⟳ Code signing ${file}`);
  }

  // ── Script phases ────────────────────────────────────────────────────────
  const scriptM = t.match(/^PhaseScriptExecution\s+(\S+)/);
  if (scriptM) return pc.cyan(`  ⟳ Script: ${scriptM[1].replace(/_/g, " ")}`);

  // ── Bundle / Install / Launch ─────────────────────────────────────────────
  if (/^Touch\b/.test(t)) {
    const file = t.split(" ")[1]?.split("/").pop() ?? "";
    return pc.cyan(`  ⟳ Creating bundle: ${file}`);
  }
  if (/^Installing\b/.test(t)) {
    const app = t.split("/").pop() ?? "";
    return pc.bold(pc.cyan(`  ⬇ Installing ${app}`));
  }
  if (/^Launching\b/.test(t)) return pc.bold(pc.green("  ▶ Launching app"));

  // ── Metro / packager ─────────────────────────────────────────────────────
  if (/BUNDLE|Metro|Loading dependency graph/.test(t)) return pc.cyan(`  ⟳ ${t}`);

  // ── Known xcode noise emitted on stderr ──────────────────────────────────
  if (/^error export\s+/.test(t)) return "";
  if (/^error VALIDATE_PRODUCT=/.test(t)) return "";
  if (/^error [A-Z0-9_]+=/.test(t)) return "";
  if (/^error .*\/common-args\.resp\b/.test(t)) {
    const summary = summarizeIosCompilerError(t);
    return pc.red(`  ✗ ${summary ?? "Compiler invocation failed"}`);
  }

  // ── Source diagnostics: /path/file.swift:10:5: error: ... ────────────────
  if (/:\s*error:/.test(t))   return pc.red(`  ✗ ${t}`);
  if (/:\s*warning:/.test(t)) return pc.yellow(`  ⚠ ${t}`);
  if (/:\s*note:/.test(t))    return pc.gray(`  ℹ ${t}`);

  // ── Generic keywords ─────────────────────────────────────────────────────
  if (/^error\s+/.test(t)) {
    const summary = summarizeIosCompilerError(t);
    return summary ? pc.red(`  ✗ ${summary}`) : "";
  }
  if (/\b(error|FAILED)\b/i.test(t))           return pc.red(`  ✗ ${t}`);
  if (/\b(warning|deprecated)\b/i.test(t))     return pc.yellow(`  ⚠ ${t}`);

  // ── Noisy lines (raw paths, env exports, tool invocations) ───────────────
  if (/^[\/]|^export |^\s*(cd |builtin-|setenv)/.test(t)) return "";
  if (/^CpResource\b|^Copy\b|^ProcessInfoPlist\b|^Validate\b|^GenerateDSYM\b/.test(t)) return "";

  return pc.gray(`  ${t}`);
}

/**
 * Android specific build output styling
 */
export function styleAndroidLine(t: string): string {
  if (!t) return "";

  if (/BUILD SUCCESSFUL/i.test(t)) return pc.bold(pc.green(`  ✓ ${t}`));
  if (/BUILD FAILED/i.test(t))     return pc.bold(pc.red(`  ✗ ${t}`));

  if (/^> Task /.test(t))              return pc.cyan(`  ▶ ${t}`);
  if (/^\d+ actionable task/.test(t)) return pc.gray(`  ${t}`);

  if (/^Installing APK/i.test(t) || /^Installed on/i.test(t)) return pc.cyan(`  ⬇ ${t}`);
  if (/Starting: Intent/.test(t)) return pc.bold(pc.green("  ▶ Launching app"));

  if (/\berror\b/i.test(t))      return pc.red(`  ✗ ${t}`);
  if (/\bwarning\b/i.test(t))    return pc.yellow(`  ⚠ ${t}`);
  if (/\bdeprecated\b/i.test(t)) return pc.yellow(`  ⚠ ${t}`);

  return pc.gray(`  ${t}`);
}

export function styleRunLine(line: string, platform: Platform | "unknown"): string {
  const t = line.trim();
  if (!t) return "";
  return platform === "ios"
    ? styleIosLine(t)
    : platform === "android"
      ? styleAndroidLine(t)
      : pc.gray(`  ${t}`);
}
