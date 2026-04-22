# Testing react-native-build-helper

## Quick Local Testing

### 1. Install locally using yarn link

```bash
cd /path/to/react-native-build-helper
yarn build
yarn link
```

This makes `rnbuild` available globally on your system.

### 2. Link to your project and test

```bash
cd /path/to/react-native-project
yarn link react-native-build-helper
rnbuild --help
```

### 3. Manual test scenarios

#### Scenario A: Fresh setup in a React Native project

```bash
# Navigate to a React Native CLI project
cd ~/my-react-native-app

# Check if project looks right
rnbuild doctor

# Initialize config
rnbuild init

# When prompted:
# - Project name: "MyApp"
# - Include iOS: yes/no
# - Add first environment: production
#   - Env file: .env.production
#   - Variables: BASE_URL=https://api.prod.com
#   - Add another: yes
# - Add second environment: development
#   - Env file: .env.dev
#   - Variables: BASE_URL=https://api.dev.local
#   - Add another: no

# View generated config
cat .rnbuildrc.yml

# Link back to local workspace
cd /path/to/react-native-build-helper
yarn link react-native-build-helper
```

#### Scenario B: Manage environments

```bash
# List all environments
rnbuild env list

# View production environment details
rnbuild env view production

# Or let it prompt you:
rnbuild env view

# Add a staging environment
rnbuild env add

# Edit development environment
rnbuild env edit development

# Remove staging environment
rnbuild env remove
```

#### Scenario C: Test build command (dry-run)

```bash
# See what would run without executing
rnbuild build --dry-run

# Or interactively:
rnbuild build
# Prompts for: environment, build type, platform
# Then shows command that would run

# Non-interactive build (dry-run)
rnbuild build --env production --type store --platform android --dry-run
```

#### Scenario D: Test with env file interpolation

```bash
# Create a test env file:
echo "BASE_URL=https://api.production.com" > .env.production
echo "API_KEY=secret123" >> .env.production

# Run doctor to verify setup
rnbuild doctor

# View environment (will show both config vars and file vars)
rnbuild env view production

# Test build with dry-run to see merged variables
rnbuild build --env production --type store --platform android --dry-run
```

## Testing Commands Breakdown

### `rnbuild init`

- Creates `.rnbuildrc.yml`
- Prompts for project name, iOS support
- Guides through environment creation
- Test with `--force` to overwrite existing config

```bash
rnbuild init                           # Interactive
rnbuild init --project-name TestApp    # With project name preset
rnbuild init --force                   # Overwrite existing
```

### `rnbuild doctor`

- Checks for `package.json`, `android/`, `ios/`, `.rnbuildrc.yml`
- Shows status of each check

```bash
rnbuild doctor
```

### `rnbuild env`

- **list**: Shows all environments
- **view**: Display environment variables
- **add**: Create new environment
- **edit**: Modify environment
- **remove**: Delete environment

```bash
rnbuild env list
rnbuild env view production
rnbuild env add
rnbuild env edit staging
rnbuild env remove development
```

### `rnbuild build`

- Runs configured build commands
- Supports `--dry-run` to preview without executing
- Interpolates variables into commands

```bash
rnbuild build                                          # Interactive
rnbuild build --env production --type store --platform android  # Direct
rnbuild build --env production --type store --platform android --dry-run  # Preview
```

## Dev Mode Testing

If you want to test without installing globally:

```bash
cd /path/to/react-native-build-helper
yarn dev init
yarn dev doctor
yarn dev build
yarn dev env list
```

## Testing Variable Interpolation

Create a test config and verify variable replacement:

```yaml
# .rnbuildrc.yml
projectName: TestApp
environments:
  development:
    envFile: .env.dev
    vars:
      BASE_URL: https://dev.local
builds:
  development:
    android:
      enabled: true
      command: echo "Building for {{ENV_NAME}} on {{PLATFORM}} - BASE_URL={{BASE_URL}}"
      outputHint: "Output would be in {{PROJECT_NAME}}/build"
```

Then run:
```bash
rnbuild build --env development --type development --platform android --dry-run
```

You should see the output with all variables replaced.

## Uninstall

When done testing:

```bash
cd /path/to/react-native-project
yarn unlink react-native-build-helper

# Or unlink from the package directory
cd /path/to/react-native-build-helper
yarn unlink
```

## Automated Testing (Optional Next Step)

If you want to add automated tests, you can:

1. Add Jest or Vitest
2. Test:
   - Config loading/writing (schema validation)
   - Env file parsing
   - Variable interpolation
   - Command formatting
3. Mock filesystem operations

Would you like me to add integration tests?
