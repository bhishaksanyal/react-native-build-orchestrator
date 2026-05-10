#!/bin/bash
source scripts/tests/common.sh

echo -e "\n🛠️ [Suite] Management Commands Tests (env, flavor, fastlane)"

setup_workspace

# Ensure config and project files exist in workspace
touch "$WORKSPACE_DIR/package.json"
mkdir -p "$WORKSPACE_DIR/android"
if [ ! -f "$WORKSPACE_DIR/.rnbuildrc.yml" ]; then
  run_cmd init --ci --project-name TestApp > /dev/null 2>&1
fi

echo "Testing 'env --ci' prompt detection..."
set +e
run_cmd env --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt
assert_json_message_contains "Prompt required but running in CI mode" stdout.txt

echo "Testing 'flavor --ci' prompt detection..."
set +e
run_cmd flavor --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt
assert_json_message_contains "Prompt required but running in CI mode" stdout.txt

echo "Testing 'fastlane --ci' prompt detection..."
set +e
run_cmd fastlane --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt
assert_json_message_contains "Prompt required but running in CI mode" stdout.txt

cleanup_workspace
