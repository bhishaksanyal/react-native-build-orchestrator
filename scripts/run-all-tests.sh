#!/bin/bash

# Mother Root Test Script for RN Build Orchestrator
set -e

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}🌟 RN Build Orchestrator - Full Test Suite 🌟${NC}"
echo -e "${BLUE}==================================================${NC}"

# Cleanup at start
rm -f .rnbuildrc.yml stdout.txt stderr.txt

# Run focused suites
chmod +x scripts/tests/*.sh

./scripts/tests/test-init.sh
./scripts/tests/test-build.sh
./scripts/tests/test-version.sh
./scripts/tests/test-release.sh
./scripts/tests/test-management.sh
./scripts/tests/test-ui.sh
./scripts/tests/verify-ci.sh

# Final Cleanup
rm -f .rnbuildrc.yml stdout.txt stderr.txt

echo -e "\n${GREEN}👑 All test suites passed successfully!${NC}"
echo -e "${BLUE}==================================================${NC}"
