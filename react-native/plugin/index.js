const {
  withPodfile,
  withSettingsGradle,
  withMainApplication,
} = require('@expo/config-plugins');

const MEASURE_POD_TAG = `# @measure/react-native`;
const MEASURE_POD_LINES = `
${MEASURE_POD_TAG}
  pod 'MeasureReactNative', :path => '../../..', :modular_headers => false
  pod 'measure-sh', :path => '../../../..', :modular_headers => false
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

function withMeasureMainApplication(config) {
  return withMainApplication(config, (mod) => {
    console.log('[Measure Plugin] modifying MainApplication.kt');

    let contents = mod.modResults.contents;

    // 1. Ensure the import is present
    if (!contents.includes('import sh.measurern.MeasurePackage')) {
      contents = contents.replace(
        /(package .*?\n)/,
        `$1import sh.measurern.MeasurePackage\n`
      );
    }

    // 2. Inject packages.add(...) just before "return packages"
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
  config = withMeasureMainApplication(config);
  return config;
};