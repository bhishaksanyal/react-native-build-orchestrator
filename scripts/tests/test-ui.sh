#!/bin/bash
source scripts/tests/common.sh

echo -e "\n${BLUE}🎨 [Suite] UI & Log Redirection Tests${NC}"

# Ensure config exists
if [ ! -f .rnbuildrc.yml ]; then
  yarn dev init --ci --project-name TestApp > /dev/null 2>&1
fi

echo "Verifying stderr/stdout separation..."
yarn dev doctor --ci > stdout.txt 2> stderr.txt

if [ -s stderr.txt ] && grep -q "RN Build Helper" stderr.txt; then
  echo -e "  ${GREEN}✅ Headers found in stderr${NC}"
else
  echo -e "  ${RED}❌ Headers not found in stderr${NC}"
  exit 1
fi

if grep -q "{" stdout.txt; then
  echo -e "  ${GREEN}✅ JSON found in stdout${NC}"
else
  echo -e "  ${RED}❌ JSON not found in stdout${NC}"
  exit 1
fi

rm -f stdout.txt stderr.txt
