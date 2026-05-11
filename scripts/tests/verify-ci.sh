#!/bin/bash
source scripts/tests/common.sh

echo -e "${BLUE}🚀 Starting Unified CI Mode Verification...${NC}"

# --- Preparation ---
cleanup_workspace
setup_workspace

# --- Test Suite 1: Config & Health ---
echo -e "\n${BLUE}📂 [Suite 1] Config & Health${NC}"

echo "Running 'doctor --ci' without config..."
set +e
run_cmd doctor --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt
assert_stderr_contains "RN Build Helper Doctor" stderr.txt

echo "Running 'init --ci' (First time)..."
touch "$WORKSPACE_DIR/package.json"
mkdir -p "$WORKSPACE_DIR/android"
run_cmd init --ci --project-name UnifiedTest > stdout.txt 2> stderr.txt
assert_json_status "success" stdout.txt
assert_stderr_contains "RN Build Helper Setup" stderr.txt

echo "Running 'init --ci' (Second time, no --force)..."
set +e
run_cmd init --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

echo "Running 'doctor --ci' with valid config..."
run_cmd doctor --ci > stdout.txt 2> stderr.txt
assert_json_status "success" stdout.txt

# --- Test Suite 2: Parameter Validation ---
echo -e "\n${BLUE}🧪 [Suite 2] Parameter Validation${NC}"

echo "Testing 'build --ci' with invalid environment..."
set +e
run_cmd build --ci --env non_existent --platform android --type development > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

echo "Testing 'version --ci' with non-integer build number..."
set +e
run_cmd version --ci --version 1.0.0 --android-build-number abc --ios-build-number 100 > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt
if ! grep -q "Android build number must be a positive integer" stdout.txt; then
  echo "❌ Error message did not mention integer requirement"
  exit 1
fi

# --- Test Suite 3: Partial Inputs & Prompts ---
echo -e "\n${BLUE}❓ [Suite 3] Partial Inputs & Prompt Detection${NC}"

echo "Testing 'release --ci' with missing mandatory flags..."
set +e
run_cmd release --ci --env development --platform android > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt
if ! grep -q "Prompt required but running in CI mode" stdout.txt; then
  echo "❌ Failed to detect required prompt"
  exit 1
fi

# --- Test Suite 4: Dry Runs & Auto-Confirmation ---
echo -e "\n${BLUE}🏃 [Suite 4] Dry Runs & Auto-Confirmation${NC}"

echo "Testing 'build --ci --dry-run'..."
run_cmd build --ci --env development --platform android --type development --dry-run > stdout.txt 2> stderr.txt
assert_json_status "success" stdout.txt
assert_stderr_contains "Dry run complete" stderr.txt

# --- Test Suite 5: Global Flag Clashes ---
echo -e "\n${BLUE}⚔️  [Suite 5] Global Flag Clashes${NC}"

echo "Testing 'version --ci --version' (Subcommand vs Global)..."
PKG_VERSION=$(node -p "require('./package.json').version")
set +e
run_cmd version --ci --version 9.9.9 --android-build-number 999 --ios-build-number 999 > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
if grep -F -q "$PKG_VERSION" stdout.txt; then
  echo "❌ Global version clash detected!"
  exit 1
fi
assert_json_status "error" stdout.txt

# --- Final Cleanup ---
cleanup_workspace

echo -e "\n${GREEN}🎉 All CI Mode verifications passed successfully!${NC}"
