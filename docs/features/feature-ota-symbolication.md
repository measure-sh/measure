---
title: "OTA Symbolication (React Native)"
description: "Symbolicate JavaScript stack traces from Over-The-Air (OTA) patches in React Native apps."
---

# OTA Symbolication (React Native)

Over-The-Air (OTA) updates let you ship JavaScript changes without a full native app release. When a crash occurs in a patched bundle, Measure needs the corresponding sourcemap to symbolicate the JavaScript stack trace.

* [**How It Works**](#how-it-works)
* [**Setup**](#setup)
  * [Automated — Metro plugin (Expo)](#automated--metro-plugin-expo)
  * [Manual — CodePush or other OTA providers](#manual--codepush-or-other-ota-providers)
* [**Upload the Sourcemap**](#upload-the-sourcemap)
* [**Uploading for Both Platforms**](#uploading-for-both-platforms)

## How It Works

Each OTA patch is identified by a unique patch ID (a UUID). When a crash occurs, the SDK attaches the patch ID to the crash report. The Measure backend uses the patch ID to look up the correct sourcemap and symbolicate the stack trace.

The patch ID can be set in two ways:

* **Automated** — The `withMeasureConfig()` Metro plugin automatically manages the patch ID for each build.

* **Manual** — You generate the patch ID yourself and pass it to `MeasureConfig`.

## Setup

### Automated - Metro plugin (Expo)

This approach requires no code changes to initialise the SDK — the patch ID is injected into the bundle at build time.

**Step 1 — Add `withMeasureConfig` to `metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withMeasureConfig } = require('@measuresh/react-native/metro');

const config = getDefaultConfig(__dirname);
module.exports = withMeasureConfig(config);
```

`withMeasureConfig` wraps the Metro config to:
- generate a random UUID on each `expo export` run
- embed it into the HBC bundle as a polyfill that executes before the app entry point
- write the same UUID as `debugId` into the `.hbc.map` sourcemap

**Step 2 — Export with source maps**

```sh
npx expo export --platform all --source-maps --output-dir dist
```

The export produces `.hbc.map` files under `dist/_expo/static/js/ios/` and `dist/_expo/static/js/android/`. Upload these after deploying the OTA update.

> [!IMPORTANT]
> Always upload the sourcemaps from the same `expo export` run that produced the bundle. Generating the sourcemap separately produces a different bundle and will result in incorrect symbolication.

---

### Manual

Use this approach when you manage the OTA update yourself and do not use the Expo/Metro build pipeline.

**Step 1 — Generate a patch ID**

Generate a UUID v4 for the patch. You can use any UUID library or the following shell command:

```sh
uuidgen | tr '[:upper:]' '[:lower:]'
```

**Step 2 — Pass the patch ID to `MeasureConfig`**

```typescript
import { Measure, MeasureConfig } from '@measuresh/react-native';

Measure.init({
  config: new MeasureConfig({
    autoStart: true,
    patchId: 'your-patch-uuid',
    patchVersion: 'v1.2.3-hotfix', // optional human-readable label
  }),
});
```

The `patchId` field must match the UUID you pass to the upload script. `patchVersion` is an optional human-readable label shown alongside the patch ID in the dashboard.

**Step 3 — Generate the sourcemap**

Generate the JavaScript sourcemap when you build the OTA bundle. The exact command depends on your OTA provider. For a manual React Native bundle:

```sh
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output main.jsbundle \
  --sourcemap-output main.jsbundle.map
```

## Upload the Sourcemap

Run `upload_patch.sh` after deploying each OTA update. The script is included with the SDK package.

**Automated mode**

Use this when the bundle was built with `withMeasureConfig()`. The script reads the patch ID directly from the sourcemap file.

```sh
./node_modules/@measuresh/react-native/scripts/upload_patch.sh \
  "your-api-key" \
  "https://your-measure-url" \
  "./dist/_expo/static/js/ios/entry-abc123.hbc.map"
```

**Manual mode**

Use this when you set `patchId` manually in `MeasureConfig`.

```sh
./node_modules/@measuresh/react-native/scripts/upload_patch.sh \
  "your-api-key" \
  "https://your-measure-url" \
  "./path/to/main.jsbundle.map" \
  "your-patch-uuid"
```

## Uploading for Both Platforms

iOS and Android bundles are compiled separately and produce different sourcemaps. Upload the sourcemap for each platform independently after deploying the OTA update.

```sh
# iOS
./node_modules/@measuresh/react-native/scripts/upload_patch.sh \
  "your-api-key" \
  "https://your-measure-url" \
  "./dist/_expo/static/js/ios/entry-abc123.hbc.map"

# Android
./node_modules/@measuresh/react-native/scripts/upload_patch.sh \
  "your-api-key" \
  "https://your-measure-url" \
  "./dist/_expo/static/js/android/entry-abc123.hbc.map"
```

