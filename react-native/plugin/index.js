const {
  withPodfile,
  withSettingsGradle,
  withMainApplication,
  withAppBuildGradle,
  withProjectBuildGradle,
} = require('@expo/config-plugins');

const MEASURE_POD_TAG = `# @measure/react-native`;
const MEASURE_POD_LINES = `
  ${MEASURE_POD_TAG}
  pod 'MeasureReactNative', :path => '../../..'
  pod 'measure-sh', :path => '../../../..'
`;

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
    console.log('[Measure Plugin] running withPodfile');
    config.modResults.contents = injectMeasurePods(config.modResults.contents);
    return config;
  });
}

function withMeasureAndroidSettings(config) {
  return withSettingsGradle(config, (mod) => {
    console.log('[Measure Plugin] modifying settings.gradle');

    const includeLine = `include(":measure-react-native")`;
    const projectLine = `project(":measure-react-native").projectDir = new File(rootDir, "../../../android")`;

    if (!mod.modResults.contents.includes(includeLine)) {
      mod.modResults.contents += `\n${includeLine}\n${projectLine}\n`;
    }

    return mod;
  });
}

/* ANDROID: Add plugin + classpath to project build.gradle */
function withMeasureProjectBuildGradle(config) {
  return withProjectBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    // Add classpath
    if (!contents.includes('sh.measure.android.gradle')) {
      contents = contents.replace(
        /dependencies\s?{/,
        `dependencies {
        classpath("sh.measure.android.gradle:sh.measure.android.gradle.gradle.plugin:0.11.0")`
      );
    }

    // Add apply plugin at bottom
    if (!contents.includes(`apply plugin: "sh.measure.android.gradle"`)) {
      contents += `\napply plugin: "sh.measure.android.gradle"\n`;
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

/* ANDROID: Add dependency + plugin to app/build.gradle */
function withMeasureAppBuildGradle(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    // 1. Add implementation dependency
    if (!contents.includes('sh.measure:measure-android')) {
      contents = contents.replace(
        /dependencies\s?{/,
        `dependencies {
        implementation("sh.measure:measure-android:0.15.0")`
      );
    }

    // 2. Add apply plugin at top
    if (!contents.includes(`apply plugin: "sh.measure.android.gradle"`)) {
      contents = `apply plugin: "sh.measure.android.gradle"\n` + contents;
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

/* ANDROID: Add MeasurePackage to MainApplication */
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

module.exports = function withMeasurePlugin(config) {
  config = withMeasureIos(config);
  config = withMeasureAndroidSettings(config);
  config = withMeasureProjectBuildGradle(config);
  config = withMeasureAppBuildGradle(config);
  config = withMeasureMainApplication(config);
  return config;
};