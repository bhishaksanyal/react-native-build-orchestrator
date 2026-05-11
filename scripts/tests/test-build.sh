#!/bin/bash
source scripts/tests/common.sh

echo -e "\n${BLUE}🛠️ [Suite] Build & Run Tests${NC}"

# Ensure config exists
if [ ! -f .rnbuildrc.yml ]; then
  yarn dev init --ci --project-name TestApp > /dev/null 2>&1
fi

echo "Testing 'build --ci' missing parameters..."
set +e
yarn dev build --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

echo "Testing 'build --ci' with invalid env..."
set +e
yarn dev build --ci --env invalid --platform android --type development > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

echo "Testing 'build --ci' dry-run..."
yarn dev build --ci --env development --platform android --type development --dry-run > stdout.txt 2> stderr.txt
assert_json_status "success" stdout.txt

echo "Testing 'run --ci' prompt detection..."
set +e
yarn dev run --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

rm -f stdout.txt stderr.txt
