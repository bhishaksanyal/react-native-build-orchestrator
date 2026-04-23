# Triage App - React Native Build Orchestrator Example

A real-world example React Native application demonstrating how to use **react-native-build-orchestrator** for managing multiple environments, flavors, build configurations, and automated releases.

## Overview

Triage App is a patient queue management application that showcases:

- **Multi-environment support** (development, staging, production)
- **Flavor-based builds** (internal, beta, production)
- **Environment-specific configurations** with `.env` files
- **Automated build processes** using rnbuild commands
- **Version management** and release automation
- **Fastlane integration** for app store uploads

## Features

- 📱 Simple patient queue management UI
- 🔧 Configurable API endpoints per environment
- 🎨 Flavor-specific branding and icons
- 🔐 Secure environment variable management
- 📊 Feature flags and analytics controls
- 🚀 One-command builds and releases

## Project Structure

```
triage-app/
├── App.tsx                      # Main React Native component
├── index.js                     # App entry point
├── package.json                 # Dependencies and scripts
├── .rnbuildrc.yml              # Build orchestrator configuration
├── .env.development            # Development environment variables
├── .env.staging                # Staging environment variables
├── .env.production             # Production environment variables
├── src/
│   └── config/
│       └── env.ts              # Config file imported by app
├── android/                    # Android native code
└── ios/                        # iOS native code
```

## Prerequisites

- Node.js >= 20.18.0
- Yarn >= 3.6.0
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development)
- React Native Build Orchestrator (the parent package)

## Installation

### 1. Install Dependencies

```bash
cd examples/triage-app
yarn install
```

### 2. Link the Local Build Orchestrator Package

During development, link the local package to test changes:

```bash
# From the root of react-native-build-orchestrator
yarn link

# From the triage-app directory
yarn link react-native-build-orchestrator
```

### 3. Initialize the App with rnbuild

```bash
# Initialize the app (creates native project structure if needed)
rnbuild init

# Check the current setup
rnbuild doctor
```

## Configuration

### `.rnbuildrc.yml` - Build Orchestrator Config

The configuration defines:

- **Environments**: development, staging, production
- **Flavors**: internal, beta, production (white-label support)
- **Build settings**: Android and iOS build commands
- **Version management**: Semantic versioning
- **Fastlane config**: App store release automation

Key sections:

```yaml
environments:
  development:
    envFile: .env.development
    vars:
      API_URL: https://dev-api.triageapp.com
      LOG_LEVEL: debug

flavors:
  internal:
    displayName: Triage (Internal)
    bundleIdSuffix: .internal
  beta:
    displayName: Triage Beta
    bundleIdSuffix: .beta
  production:
    displayName: Triage
```

### Environment Files

Each environment has its own `.env` file with specific variables:

- **.env.development**: Debug logs, feature flags enabled
- **.env.staging**: Staging API, feature testing
- **.env.production**: Production API, minimal logging

## Usage

### Development

```bash
# Start the development server
yarn start

# Run on Android emulator/device
yarn android

# Run on iOS simulator/device
yarn ios
```

### Building

#### Development Build

```bash
# Build Android for development
rnbuild build --env development --type android --flavor internal

# Build iOS for development
rnbuild build --env development --type ios --flavor internal
```

#### Production Build

```bash
# Build Android for production
yarn build:android:prod

# Build iOS for production
yarn build:ios:prod

# Or using rnbuild directly
rnbuild build --env production --type android --flavor production
rnbuild build --env production --type ios --flavor production
```

### Version Management

```bash
# Check current version
yarn release:check

# Bump patch version (1.0.0 → 1.0.1)
yarn release:patch

# Bump minor version (1.0.0 → 1.1.0)
yarn release:minor

# Bump major version (1.0.0 → 2.0.0)
yarn release:major
```

### Releases to App Stores

```bash
# Upload to iOS TestFlight
yarn upload:ios

# Upload to Google Play beta track
yarn upload:android

# Or using rnbuild
rnbuild upload --platform ios
rnbuild upload --platform android
```

## Workflow Examples

### Example 1: Development to Staging

```bash
# Make changes locally
echo "API_URL=https://staging-api.triageapp.com" > .env.staging

# Switch environment and build
rnbuild build --env staging --type android --flavor beta

# Bump version and prepare release
rnbuild version minor

# Build production flavor for staging env
rnbuild build --env staging --type ios --flavor production
```

### Example 2: Multi-Flavor Internal Distribution

```bash
# Build internal flavor for all environments
rnbuild build --env development --type android --flavor internal
rnbuild build --env development --type ios --flavor internal

# Use Fastlane to distribute internally
cd ios && fastlane beta
```

### Example 3: CI/CD Pipeline

The GitHub Actions workflow (in parent `.github/workflows/ci.yml`) can be extended to:

1. Run tests
2. Build for staging
3. Bump version
4. Upload to TestFlight/Google Play beta
5. Create release notes

## Debugging

### Check Build Configuration

```bash
rnbuild doctor
```

### View Generated Environment Config

After running `rnbuild init`, check the generated files:

```bash
cat rnbuild.env.ts
cat src/config/env.ts
```

### Enable Debug Logging

```bash
# Run with debug output
rnbuild build --env development --type android --dry-run
```

## Troubleshooting

### Issue: Module not found error for rnbuild.env

**Solution**: Run `rnbuild init` first to generate the environment files.

```bash
rnbuild init
```

### Issue: Build fails with "bundleIdSuffix" error

**Solution**: Ensure your `.rnbuildrc.yml` has valid flavor configuration and the app is properly initialized.

```bash
rnbuild doctor
```

### Issue: Fastlane fails to upload

**Solution**: 
1. Configure Fastlane credentials (see `.rnbuildrc.yml`)
2. Ensure valid app identifiers and certificates
3. Check `android/fastlane/key.json` and iOS certificates exist

## Next Steps

1. **Customize the UI**: Modify `App.tsx` to match your needs
2. **Add navigation**: Integrate React Navigation for multi-screen apps
3. **Implement API calls**: Use the `Config.apiUrl` from environment config
4. **Set up CI/CD**: Create GitHub Actions workflows for automated builds
5. **Configure signing**: Set up Android/iOS signing certificates
6. **Add feature flags**: Use `Config.featureFlagsEnabled` for A/B testing

## Resources

- [React Native Documentation](https://reactnative.dev/)
- [React Native Build Orchestrator Docs](../../README.md)
- [Fastlane Documentation](https://docs.fastlane.tools/)
- [React Navigation](https://reactnavigation.org/)

## Support

For issues with the build orchestrator, see the main package README or visit the [GitHub repository](https://github.com/bhishaksanyal/react-native-build-orchestrator).

## License

MIT - Same as the parent react-native-build-orchestrator package
