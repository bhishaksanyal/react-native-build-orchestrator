#!/bin/bash
source scripts/tests/common.sh

echo -e "\n🔢 [Suite] Version Tests"

echo "Testing 'version --ci' validation (missing version)..."
set +e
yarn dev version --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

echo "Testing 'version --ci' invalid build number..."
set +e
yarn dev version --ci --version 1.0.0 --android-build-number abc --ios-build-number 100 > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

echo "Testing 'version --ci' global flag clash..."
set +e
yarn dev version --ci --version 1.0.0 --android-build-number 100 --ios-build-number 100 > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
if grep -q "1.3.0" stdout.txt; then
  echo "❌ Global version clash detected!"
  exit 1
fi
assert_json_status "error" stdout.txt

rm -f stdout.txt stderr.txt
