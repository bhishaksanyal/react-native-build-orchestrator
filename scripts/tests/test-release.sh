#!/bin/bash
source scripts/tests/common.sh

echo -e "\n${BLUE}🚀 [Suite] Release Tests${NC}"

echo "Testing 'release --ci' prompt detection..."
set +e
yarn dev release --ci > stdout.txt 2> stderr.txt
EXIT_CODE=$?
set -e
assert_exit_code 1 $EXIT_CODE
assert_json_status "error" stdout.txt

echo "Testing 'release --ci' dry-run..."
yarn dev release --ci --env development --platform android --type development --lane deploy --track internal --dry-run > stdout.txt 2> stderr.txt
assert_json_status "success" stdout.txt

rm -f stdout.txt stderr.txt
