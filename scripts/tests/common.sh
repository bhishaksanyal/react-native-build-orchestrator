#!/bin/bash

# Common utilities for CI tests
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

function assert_json_status() {
  local expected=$1
  local file=$2
  if grep -q "\"status\": \"$expected\"" "$file"; then
    echo -e "  ${GREEN}✅ Matches expected status: $expected${NC}"
  else
    echo -e "  ${RED}❌ Expected status $expected not found in output${NC}"
    echo "Output was:"
    cat "$file"
    exit 1
  fi
}

function assert_exit_code() {
  local expected=$1
  local actual=$2
  if [ "$expected" -eq "$actual" ]; then
    echo -e "  ${GREEN}✅ Exit code matches: $expected${NC}"
  else
    echo -e "  ${RED}❌ Exit code mismatch. Expected $expected, got $actual${NC}"
    exit 1
  fi
}

function assert_stderr_contains() {
  local pattern=$1
  local file=$2
  if grep -q "$pattern" "$file"; then
    echo -e "  ${GREEN}✅ Stderr contains: $pattern${NC}"
  else
    echo -e "  ${RED}❌ Pattern '$pattern' not found in stderr${NC}"
    exit 1
  fi
}
function assert_json_message_contains() {
  local pattern=$1
  local file=$2
  if grep -q "\"message\": \".*$pattern.*\"" "$file"; then
    echo -e "  ${GREEN}✅ JSON message contains: $pattern${NC}"
  else
    echo -e "  ${RED}❌ Pattern '$pattern' not found in JSON message${NC}"
    echo "Output was:"
    cat "$file"
    exit 1
  fi
}
WORKSPACE_DIR="ci-test-workspace"

function setup_workspace() {
  mkdir -p "$WORKSPACE_DIR"
}

function cleanup_workspace() {
  rm -rf "$WORKSPACE_DIR"
  rm -f stdout.txt stderr.txt
}

function run_cmd() {
  yarn dev "$@" --cwd "$WORKSPACE_DIR"
}
