const {
  withPodfile,
  withMainApplication,
  withAppBuildGradle,
  withProjectBuildGradle,
  withXcodeProject,
  withAndroidManifest,
} = require('@expo/config-plugins');

// When installed, this file lives at:
//   node_modules/@measuresh/react-native/plugin/index.js
// So the package root is one directory up from __dirname.
// From the iOS project (ios/) the package is at ../node_modules/@measuresh/react-native.
const PACKAGE_NAME = '@measuresh/react-native';
const IOS_POD_PATH = `../node_modules/${PACKAGE_NAME}`;

const MEASURE_POD_TAG = `# ${PACKAGE_NAME}`;
const MEASURE_POD_LINES = `
  ${MEASURE_POD_TAG}
  pod 'MeasureReactNative', :path => '${IOS_POD_PATH}'
`;

const BUNDLE_PHASE_NAME = 'Bundle React Native code and images';
const UPLOAD_PHASE_NAME = 'Upload Measure Symbol Files';
const SOURCEMAP_EXPORT = 'export SOURCEMAP_FILE="$(pwd)/main.jsbundle.map"';

const ANDROID_META_KEY_API_KEY = 'sh.measure.android.API_KEY';
const ANDROID_META_KEY_API_URL = 'sh.measure.android.API_URL';

// ─── iOS: Podfile ────────────────────────────────────────────────────────────

function injectMeasurePods(contents) {
  if (!contents.includes(MEASURE_POD_TAG)) {
    return contents.replace(
      /use_react_native!\([\s\S]*?\)/,
      (match) => `${match}\n\n${MEASURE_POD_LINES}`
    );
  }
  return contents;
}

function withMeasureIos(config) {
  return withPodfile(config, (config) => {
    config.modResults.contents = injectMeasurePods(config.modResults.contents);
    return config;
  });
}

// ─── iOS: Xcode build phases ─────────────────────────────────────────────────

/**
 * 1. Prepends `export SOURCEMAP_FILE=...` to the "Bundle React Native code and
 *    images" shell script so the Hermes-composed sourcemap is generated on every
 *    Release build.
 * 2. Adds an "Upload Measure Symbol Files" Run Script phase that calls
 *    upload_build_phase.sh with the iOS-specific API credentials.
 */
function withMeasureXcodeBuildPhases(config, { iosApiKey, iosApiUrl }) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const shellScriptPhases =
      xcodeProject.hash.project.objects['PBXShellScriptBuildPhase'] || {};

    // 1. Inject SOURCEMAP_FILE into the bundle build phase
    for (const phase of Object.values(shellScriptPhases)) {
      if (typeof phase !== 'object' || !phase.name) continue;
      const name = phase.name.replace(/^"|"$/g, '');
      if (name !== BUNDLE_PHASE_NAME) continue;

      try {
        const script = JSON.parse(phase.shellScript);
        if (!script.includes('SOURCEMAP_FILE')) {
          phase.shellScript = JSON.stringify(`${SOURCEMAP_EXPORT}\n${script}`);
        }
      } catch {
        // If parsing fails leave the phase untouched
      }
      break;
    }

    // 2. Add upload build phase (idempotent)
    const alreadyAdded = Object.values(shellScriptPhases).some((phase) => {
      if (typeof phase !== 'object' || !phase.shellScript) return false;
      try {
        return JSON.parse(phase.shellScript).includes('upload_build_phase.sh');
      } catch {
        return false;
      }
    });

    if (!alreadyAdded) {
      const uploadScript = `"$SRCROOT/../node_modules/${PACKAGE_NAME}/scripts/upload_build_phase.sh" "${iosApiUrl}" "${iosApiKey}"`;

      const nativeTargets = xcodeProject.pbxNativeTargetSection();
      const appTargetEntry = Object.entries(nativeTargets).find(
        ([, t]) => t.productType === '"com.apple.product-type.application"'
      );

      if (appTargetEntry) {
        const [targetKey] = appTargetEntry;
        xcodeProject.addBuildPhase(
          [],
          'PBXShellScriptBuildPhase',
          UPLOAD_PHASE_NAME,
          targetKey,
          {
            shellPath: '/bin/bash',
            shellScript: uploadScript,
            showEnvVarsInLog: 0,
            runOnlyForDeploymentPostprocessing: 0,
          }
        );
      }
    }

    return config;
  });
}

// ─── Android: AndroidManifest.xml ─────────────────────────────────────────────

/**
 * Injects the Measure API key and URL as <meta-data> tags in the
 * AndroidManifest.xml application element. These are read by the Measure
 * Android Gradle plugin to upload mapping files after each build.
 */
function withMeasureAndroidManifest(config, { androidApiKey, androidApiUrl }) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    const metaData = application['meta-data'];

    const setMetaData = (name, value) => {
      const existing = metaData.find((m) => m.$?.['android:name'] === name);
      if (existing) {
        existing.$['android:value'] = value;
      } else {
        metaData.push({ $: { 'android:name': name, 'android:value': value } });
      }
    };

    setMetaData(ANDROID_META_KEY_API_KEY, androidApiKey);
    setMetaData(ANDROID_META_KEY_API_URL, androidApiUrl);

    return config;
  });
}

// ─── Android: project-level build.gradle ─────────────────────────────────────

function withMeasureProjectBuildGradle(config) {
  return withProjectBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    if (!contents.includes('sh.measure.android.gradle')) {
      contents = contents.replace(
        /dependencies\s?{/,
        `dependencies {
        classpath("sh.measure.android.gradle:sh.measure.android.gradle.gradle.plugin:0.11.0")`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

// ─── Android: app/build.gradle ───────────────────────────────────────────────

function withMeasureAppBuildGradle(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    if (!contents.includes('sh.measure:measure-android')) {
      contents = contents.replace(
        /dependencies\s?{/,
        `dependencies {
        implementation("sh.measure:measure-android:0.17.0")`
      );
    }

    // Apply the Measure Gradle plugin AFTER all other plugins so that
    // com.android.application is already applied when Measure checks for it.
    if (!contents.includes(`apply plugin: "sh.measure.android.gradle"`)) {
      contents = contents.trimEnd() + `\napply plugin: "sh.measure.android.gradle"\n`;
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

// ─── Android: MainApplication ────────────────────────────────────────────────

function withMeasureMainApplication(config) {
  return withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;

    if (!contents.includes('import sh.measure.rn.MeasurePackage')) {
      contents = contents.replace(
        /(package .*?\n)/,
        `$1import sh.measure.rn.MeasurePackage\n`
      );
    }

    if (!contents.includes('packages.add(MeasurePackage())')) {
      contents = contents.replace(
        /(return\s+packages;?)/,
        `packages.add(MeasurePackage())\n            $1`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

module.exports = function withMeasurePlugin(config, options = {}) {
  const { androidApiKey, androidApiUrl, iosApiKey, iosApiUrl } = options;

  // iOS
  config = withMeasureIos(config);
  if (iosApiKey && iosApiUrl) {
    config = withMeasureXcodeBuildPhases(config, { iosApiKey, iosApiUrl });
  }

  // Android
  config = withMeasureProjectBuildGradle(config);
  config = withMeasureAppBuildGradle(config);
  config = withMeasureMainApplication(config);
  if (androidApiKey && androidApiUrl) {
    config = withMeasureAndroidManifest(config, { androidApiKey, androidApiUrl });
  }

  return config;
};
