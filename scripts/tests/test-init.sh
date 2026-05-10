#!/bin/bash
source scripts/tests/common.sh

echo -e "\n📂 [Suite] Init & Doctor Tests"

cleanup_workspace
setup_workspace

echo "Running 'doctor --ci' without config..."
set +e
run_cmd doctor --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

echo "Running 'init --ci'..."
# Create dummy files for doctor to eventually pass
touch "$WORKSPACE_DIR/package.json"
mkdir -p "$WORKSPACE_DIR/android"
run_cmd init --ci --project-name TestApp > stdout.txt 2> stderr.txt
assert_json_status "success" stdout.txt

echo "Running 'doctor --ci' with config..."
run_cmd doctor --ci > stdout.txt 2> stderr.txt
assert_json_status "success" stdout.txt

echo "Running 'init --ci' again (should fail)..."
set +e
run_cmd init --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

cleanup_workspace
