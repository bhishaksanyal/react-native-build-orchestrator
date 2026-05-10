#!/bin/bash

# Unified CI Mode Verification Suite for RN Build Orchestrator
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Unified CI Mode Verification...${NC}"

function assert_json_status() {
  local expected=$1
  local file=$2
  if grep -q "\"status\": \"$expected\"" "$file"; then
    echo -e "  ${GREEN}✅ Matches expected status: $expected${NC}"
  else
    echo -e "  ${RED}❌ Expected status $expected not found in output${NC}"
    echo "Output was:"
    cat "$file"
    exit 1
  fi
}

function assert_exit_code() {
  local expected=$1
  local actual=$2
  if [ "$expected" -eq "$actual" ]; then
    echo -e "  ${GREEN}✅ Exit code matches: $expected${NC}"
  else
    echo -e "  ${RED}❌ Exit code mismatch. Expected $expected, got $actual${NC}"
    exit 1
  fi
}

function assert_stderr_contains() {
  local pattern=$1
  local file=$2
  if grep -q "$pattern" "$file"; then
    echo -e "  ${GREEN}✅ Stderr contains: $pattern${NC}"
  else
    echo -e "  ${RED}❌ Pattern '$pattern' not found in stderr${NC}"
    cat "$file"
    exit 1
  fi
}

# --- Preparation ---
rm -f .rnbuildrc.yml stdout.txt stderr.txt

# --- Test Suite 1: Config & Health ---
echo -e "\n📂 [Suite 1] Config & Health"

echo "Running 'doctor --ci' without config..."
set +e
yarn dev doctor --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt
assert_stderr_contains "RN Build Helper Doctor" stderr.txt

echo "Running 'init --ci' (First time)..."
yarn dev init --ci --project-name UnifiedTest > stdout.txt 2> stderr.txt
assert_json_status "success" stdout.txt
assert_stderr_contains "RN Build Helper Setup" stderr.txt

echo "Running 'init --ci' (Second time, no --force)..."
set +e
yarn dev init --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

echo "Running 'doctor --ci' with valid config..."
yarn dev doctor --ci > stdout.txt 2> stderr.txt
assert_json_status "success" stdout.txt

# --- Test Suite 2: Parameter Validation ---
echo -e "\n🧪 [Suite 2] Parameter Validation"

echo "Testing 'build --ci' with invalid environment..."
set +e
yarn dev build --ci --env non_existent --platform android --type development > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

echo "Testing 'version --ci' with non-integer build number..."
set +e
yarn dev version --ci --version 1.0.0 --android-build-number abc --ios-build-number 100 > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt
if ! grep -q "Android build number must be a positive integer" stdout.txt; then
  echo "❌ Error message did not mention integer requirement"
  exit 1
fi

# --- Test Suite 3: Partial Inputs & Prompts ---
echo -e "\n❓ [Suite 3] Partial Inputs & Prompt Detection"

echo "Testing 'release --ci' with missing mandatory flags..."
set +e
yarn dev release --ci --env development --platform android > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt
if ! grep -q "Prompt required but running in CI mode" stdout.txt; then
  echo "❌ Failed to detect required prompt"
  exit 1
fi

# --- Test Suite 4: Dry Runs & Auto-Confirmation ---
echo -e "\n🏃 [Suite 4] Dry Runs & Auto-Confirmation"

echo "Testing 'build --ci --dry-run'..."
yarn dev build --ci --env development --platform android --type development --dry-run > stdout.txt 2> stderr.txt
assert_json_status "success" stdout.txt
assert_stderr_contains "Dry run complete" stderr.txt

# --- Test Suite 5: Global Flag Clashes ---
echo -e "\n⚔️  [Suite 5] Global Flag Clashes"

echo "Testing 'version --ci --version' (Subcommand vs Global)..."
set +e
yarn dev version --ci --version 9.9.9 --android-build-number 999 --ios-build-number 999 > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
if grep -q "1.3.0" stdout.txt; then
  echo "❌ Global version clash detected!"
  exit 1
fi
assert_json_status "error" stdout.txt

# --- Final Cleanup ---
rm .rnbuildrc.yml stdout.txt stderr.txt

echo -e "\n${GREEN}🎉 All CI Mode verifications passed successfully!${NC}"
