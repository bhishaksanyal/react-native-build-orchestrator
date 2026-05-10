#!/bin/bash
source scripts/tests/common.sh

echo -e "\n🛠️ [Suite] Management Commands Tests (env, flavor, fastlane)"

# Ensure config exists
if [ ! -f .rnbuildrc.yml ]; then
  yarn dev init --ci --project-name TestApp > /dev/null 2>&1
fi

echo "Testing 'env --ci' prompt detection..."
set +e
yarn dev env --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

echo "Testing 'flavor --ci' prompt detection..."
set +e
yarn dev flavor --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

echo "Testing 'fastlane --ci' prompt detection..."
set +e
yarn dev fastlane --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

rm -f stdout.txt stderr.txt
