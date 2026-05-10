#!/bin/bash
source scripts/tests/common.sh

echo -e "\n📂 [Suite] Init & Doctor Tests"

rm -f .rnbuildrc.yml stdout.txt stderr.txt

echo "Running 'doctor --ci' without config..."
set +e
yarn dev doctor --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

echo "Running 'init --ci'..."
yarn dev init --ci --project-name TestApp > stdout.txt 2> stderr.txt
assert_json_status "success" stdout.txt

echo "Running 'doctor --ci' with config..."
yarn dev doctor --ci > stdout.txt 2> stderr.txt
assert_json_status "success" stdout.txt

echo "Running 'init --ci' again (should fail)..."
set +e
yarn dev init --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

rm -f stdout.txt stderr.txt
