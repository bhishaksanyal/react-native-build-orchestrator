# Fastlane Troubleshooting Guide

This guide covers common issues, debugging techniques, and solutions for Fastlane upload failures when using `rnbuild release`. It is intended for developers who encounter store upload errors and need to diagnose and fix them quickly.

---

## Table of Contents

1. [General debugging approach](#general-debugging-approach)
2. [Common errors and solutions](#common-errors-and-solutions)
3. [Android (Google Play) troubleshooting](#android-google-play-troubleshooting)
4. [iOS (App Store Connect) troubleshooting](#ios-app-store-connect-troubleshooting)
5. [Authentication debugging](#authentication-debugging)
6. [CI environment debugging](#ci-environment-debugging)
7. [Getting verbose Fastlane logs](#getting-verbose-fastlane-logs)
8. [Configuring custom Fastfiles](#configuring-custom-fastfiles)

---

## General debugging approach

When a `rnbuild release` fails during the upload phase, follow these steps in order:

### 1. Run a dry-run first

```bash
yarn rnbuild release --env production --platform android --type store --dry-run
```

This shows the exact Fastlane command that will be executed without running it. Verify the `artifact_path` points to an existing file.

### 2. Run the Fastlane command directly

Copy the command from the dry-run output and run it directly in your project directory to see raw Fastlane output:

```bash
cd /path/to/project
bundle exec fastlane android upload_store \
  track:"internal" \
  artifact_type:"aab" \
  artifact_path:"android/app/build/outputs/bundle/release/app-release.aab"
```

### 3. Enable verbose logging

Append `--verbose` (Fastlane) or set `FL_VERBOSE=true` to get detailed logs:

```bash
FL_VERBOSE=true bundle exec fastlane android upload_store [...] --verbose
```

### 4. Check the artifact exists

```bash
ls -la android/app/build/outputs/bundle/release/app-release.aab
```

If the file is missing, the build step failed. Run `rnbuild build` separately to confirm.

### 5. Verify authentication credentials

Check that the required environment variables are set:

```bash
# Android
echo "SUPPLY_JSON_KEY_DATA set: ${SUPPLY_JSON_KEY_DATA:+yes}"

# iOS
echo "App Store Connect API Key set: ${APP_STORE_CONNECT_API_KEY_KEY_ID:+yes}"
```

---

## Common errors and solutions

| Error message | Likely cause | Diagnostic command | Fix |
|---|---|---|---|
| `Fastlane upload failed` | Non-zero exit code from Fastlane | Run the Fastlane command directly with `--verbose` | Check the raw Fastlane output for details |
| `Artifact not found: /path/to/file` | Build artifact path is wrong or build failed | `ls -la <artifact_path>` | Verify the build completed; update `outputHint` in config or pass `--artifact-path` |
| `Artifact path is required for upload` | No artifact path resolved and none prompted | Check config has `outputHint` | Add `outputHint` to build target or pass `--artifact-path` |
| `Google Api Error: apkNotUpToDate` | APK versionCode is lower than the live version | Check `android/app/build.gradle` versionCode | Increment versionCode via `rnbuild version` |
| `Google Api Error: forbidden` | Service account lacks permissions | Check Google Play Console IAM | Grant "Release manager" role to the service account |
| `Google Api Error: appNotListed` | App not found on the specified track | Check that the first release was done manually | Add the app to the track via Play Console first |
| `Google Api Error: apkNoPackageName` | Missing package name in supply call | Check `.rnbuildrc.yml` fastlane.android.packageName | Set `packageName` in config or Appfile |
| `Authentication required` | Missing or expired credentials | `echo $SUPPLY_JSON_KEY_DATA` | Re-download and set the service account key |
| `The request could not be completed` | Network issue or Apple server outage | `curl -I https://apple.com` | Retry after a few minutes |
| `execution expired` | Network timeout | `ping -c 3 play.google.com` | Check network connectivity; increase CI timeout |
| `Could not find action 'supply'` | Missing Fastlane plugin | `bundle exec fastlane add_plugin supply` | Install the supply plugin |
| `bundle exec fastlane not found` | Bundler not installed or Gemfile missing | `bundle --version` | Run `gem install bundler` and create a Gemfile |
| `[!] Invalid lane name` | Lane name mismatch between config and Fastfile | Check `fastlane/Fastfile` for lane names | Use `--lane` with the exact name from the Fastfile |

---

## Android (Google Play) troubleshooting

### Service account setup

The `supply` action requires a Google Play service account:

1. Go to [Google Play Console](https://play.google.com/console/) → Setup → API access
2. Create a service account or link an existing one
3. Grant it **Release manager** permissions (not just "Viewer")
4. Download the JSON private key
5. Set it as an environment variable:

```bash
export SUPPLY_JSON_KEY_DATA='{
  "type": "service_account",
  "project_id": "...",
  ...
}'
```

Or use a file-based approach:

```bash
export SUPPLY_JSON_KEY=/path/to/key.json
```

**Verify authentication works:**

```bash
bundle exec fastlane run validate_play_store_json_key json_key:/path/to/key.json
```

### Common Android errors

#### `apkNotUpToDate`

The versionCode in your APK/AAB is lower than or equal to the version already live on the track. Fix:

```bash
yarn rnbuild version --version 1.2.0 --android-build-number 123
```

Increment the build number above the current live version.

#### `forbidden` / permission denied

The service account lacks required roles. In Google Play Console:

1. Go to Setup → API access
2. Find your service account
3. Ensure it has **Release manager** role (not "Viewer" or "Financial")

#### Multiple APKs/AABs error

If supply receives multiple artifacts, it may fail. The generated Fastfile only uploads one artifact at a time. Ensure only one file matches your artifact path.

#### Release not yet promoted

When using `internal` track, the release must first be promoted through tracks progressively (`internal → alpha → beta → production` on Play Console). You cannot upload directly to `production` without going through the process, though supply allows it via a track rollout.

### Test supply locally

```bash
# Dry-run what supply would do
bundle exec fastlane run supply \
  track:internal \
  aab:android/app/build/outputs/bundle/release/app-release.aab \
  skip_upload_metadata:true \
  skip_upload_images:true \
  skip_upload_screenshots:true
```

---

## iOS (App Store Connect) troubleshooting

### API Key authentication (recommended)

Fastlane can use App Store Connect API Keys instead of Apple ID/password:

1. Go to [App Store Connect](https://appstoreconnect.apple.com/) → Users and Access → Keys
2. Generate an API Key with "Admin" access
3. Download the `.p8` file
4. Set environment variables:

```bash
export APP_STORE_CONNECT_API_KEY_KEY_ID="ABC123DEFG"
export APP_STORE_CONNECT_API_KEY_ISSUER_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export APP_STORE_CONNECT_API_KEY_KEY="/path/to/AuthKey_ABC123DEFG.p8"
```

**Verify authentication:**

```bash
bundle exec fastlane run check_app_store_metadata app_identifier:com.example.app
```

### Common iOS errors

#### `The App ID is not available`

The bundle identifier in your Appfile or config doesn't match any app in App Store Connect. Verify the app exists and the bundle ID matches exactly.

#### `Apple ID / password incorrect`

When using legacy authentication (apple_id + password), you must use an **app-specific password**:

```bash
export FASTLANE_USER="developer@example.com"
export FASTLANE_PASSWORD="@env MY_APP_SPECIFIC_PASSWORD"
```

Generate an app-specific password at [appleid.apple.com](https://appleid.apple.com/) → App-Specific Passwords.

#### `Your session has expired`

Fastlane session tokens expire. Re-authenticate or use API Key authentication (recommended) which doesn't have this issue.

#### TestFlight processing never completes

The generated fastfile uses `skip_waiting_for_build_processing: true`. This means `pilot` returns immediately after upload without waiting for processing. Check processing status in App Store Connect.

#### `Missing iOS distribution certificate`

Fastlane's `match` or manual signing setup is required before upload. Ensure you have a valid distribution certificate and provisioning profile.

### Test pilot (TestFlight) locally

```bash
bundle exec fastlane run pilot \
  ipa:ios/build/MyApp.ipa \
  skip_waiting_for_build_processing:true
```

### Test deliver (App Store) locally

```bash
bundle exec fastlane run deliver \
  ipa:ios/build/MyApp.ipa \
  submit_for_review:false \
  automatic_release:false \
  skip_metadata:true \
  skip_screenshots:true
```

---

## Authentication debugging

### Check all Fastlane-related environment variables

Run this from your project or CI environment:

```bash
echo "=== Android (Google Play) ==="
echo "SUPPLY_JSON_KEY_DATA: ${SUPPLY_JSON_KEY_DATA:+set (${#SUPPLY_JSON_KEY_DATA} chars)}"
echo "SUPPLY_JSON_KEY: ${SUPPLY_JSON_KEY:-not set}"
echo ""
echo "=== iOS (App Store Connect) ==="
echo "APP_STORE_CONNECT_API_KEY_KEY_ID: ${APP_STORE_CONNECT_API_KEY_KEY_ID:-not set}"
echo "APP_STORE_CONNECT_API_KEY_ISSUER_ID: ${APP_STORE_CONNECT_API_KEY_ISSUER_ID:-not set}"
echo "APP_STORE_CONNECT_API_KEY_KEY: ${APP_STORE_CONNECT_API_KEY_KEY:-not set}"
echo "FASTLANE_USER: ${FASTLANE_USER:-not set}"
echo "FASTLANE_PASSWORD: ${FASTLANE_PASSWORD:+set (hidden)}"
echo ""
echo "=== Infrastructure ==="
echo "FASTLANE_ITUNES_TRANSPORTER_PATH: ${FASTLANE_ITUNES_TRANSPORTER_PATH:-not set}"
echo "DELIVER_ITUNES_TRANSPORTER_USE_ITMSTRANSPORTER: ${DELIVER_ITUNES_TRANSPORTER_USE_ITMSTRANSPORTER:-not set}"
```

### Validate Google Play JSON key

```bash
# Check that the JSON key is valid JSON
echo "$SUPPLY_JSON_KEY_DATA" | python3 -m json.tool > /dev/null && echo "Valid JSON key" || echo "Invalid JSON key"

# Check expiration
echo "$SUPPLY_JSON_KEY_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Key ID:', d.get('private_key_id', 'missing')); print('Client email:', d.get('client_email', 'missing')); print('Expired:', d.get('private_key', 'missing')[:50]+'...')"
```

### Validate App Store Connect API Key

```bash
# Check that the .p8 file exists and has correct format
head -c 50 "$APP_STORE_CONNECT_API_KEY_KEY" | grep -q "BEGIN PRIVATE KEY" && echo "Valid .p8 key file" || echo "Invalid .p8 key file"
```

---

## CI environment debugging

### GitHub Actions

Use the `--raw-logs` flag to see raw Fastlane output in CI logs (styled output may hide details):

```bash
yarn rnbuild release \
  --env production \
  --platform android \
  --type store \
  --lane upload_store \
  --track internal \
  --ci \
  --raw-logs
```

Add a debug step to your workflow to inspect the environment:

```yaml
- name: Debug Fastlane environment
  run: |
    echo "SUPPLY_JSON_KEY_DATA length: ${#SUPPLY_JSON_KEY_DATA}"
    ruby -v
    gem list fastlane
    bundle exec fastlane --version
  env:
    SUPPLY_JSON_KEY_DATA: ${{ secrets.SUPPLY_JSON_KEY_DATA }}
```

### Common CI failures

#### Timeout uploading large artifacts

Uploading large AAB/IPA files can exceed default CI timeouts:

```bash
# Increase timeout for the step
- name: Build and Release
  timeout-minutes: 30
  run: yarn rnbuild release --env production --platform android --ci
```

#### Missing Ruby or Bundler

Ubuntu GitHub runners don't include Ruby by default. Use `ruby/setup-ruby`:

```yaml
- uses: ruby/setup-ruby@v1
  with:
    ruby-version: "3.2"
    bundler-cache: true
```

#### iTunes Transporter issues (iOS)

The iTunes Transporter can hang in some CI environments. Set these environment variables to use the newer `itmstransporter`:

```bash
export FASTLANE_ITUNES_TRANSPORTER_PATH=/usr/local/bin/iTMSTransporter
export DELIVER_ITUNES_TRANSPORTER_USE_ITMSTRANSPORTER=1
```

On macOS runners, ensure Java is available:

```bash
# Required by iTunes Transporter
export JAVA_HOME=/Library/Java/JavaVirtualMachines/openjdk.jdk/Contents/Home
```

#### Docker environments

In Docker containers, Fastlane may need additional dependencies:

```dockerfile
RUN apt-get update && apt-get install -y \
  ruby-full \
  build-essential \
  libffi-dev \
  && gem install bundler fastlane
```

---

## Getting verbose Fastlane logs

### Fastlane verbose mode

```bash
# Set before running any Fastlane command
export FL_VERBOSE=true

# Or pass --verbose to the lane
bundle exec fastlane android upload_store --verbose
```

### Raw output from rnbuild

Use `--raw-logs` with `rnbuild release` to see unstyled Fastlane output:

```bash
yarn rnbuild release --env production --platform android --type store --raw-logs
```

### Capturing logs for debugging

```bash
# Save Fastlane output to a file
yarn rnbuild release --env production --platform android --type store --raw-logs 2>&1 | tee fastlane-debug.log

# Or save only stderr (where logs go in --ci mode)
yarn rnbuild release --env production --platform android --type store --ci --raw-logs 2>fastlane-ci-debug.log
```

### Fastlane environment info

```bash
bundle exec fastlane env
```

This outputs a full system report including Ruby version, Fastlane version, installed plugins, and environment variables. Include this output when reporting issues.

---

## Configuring custom Fastfiles

If the generated Fastfile doesn't meet your needs, you can edit it freely. The key is to keep the same lane name so `rnbuild release --lane` continues to work:

### Android: custom changelog and release notes

```ruby
lane :upload_store do |options|
  track_name = options[:track] || "internal"
  artifact_path = options[:artifact_path]

  supply(
    track: track_name,
    aab: artifact_path,
    skip_upload_metadata: false,
    skip_upload_images: true,
    skip_upload_screenshots: true,
    release_status: "completed",
    version_name: ENV["NEW_VERSION"]  # Read from rnbuild runtime env
  )
end
```

### iOS: auto-submit for review with phased release

```ruby
lane :upload_store do |options|
  destination = options[:track] || "testflight"

  if destination == "app_store"
    deliver(
      ipa: options[:artifact_path],
      submit_for_review: true,
      automatic_release: true,
      phased_release: true,
      skip_metadata: false,
      skip_screenshots: true
    )
  else
    pilot(
      ipa: options[:artifact_path],
      skip_waiting_for_build_processing: false,
      distribute_only: true,
      notify_external_testers: true
    )
  end
end
```

### Webhook notification on failure

```ruby
lane :upload_store do |options|
  begin
    # ... existing upload logic ...
  rescue => ex
    sh "curl -X POST -H 'Content-Type: application/json' \
      -d '{\"text\": \"Upload failed: #{ex.message}\"}' \
      #{ENV['SLACK_WEBHOOK_URL']}"
    raise ex
  end
end
```

---

## Getting help

If you've gone through this guide and still have issues:

- Check [Fastlane documentation](https://docs.fastlane.tools/)
- Check [Fastlane GitHub issues](https://github.com/fastlane/fastlane/issues)
- Open an issue on [rnbuild GitHub](https://github.com/bhishaksanyal/react-native-build-orchestrator/issues)
- Run `bundle exec fastlane env` and include the output in your issue
