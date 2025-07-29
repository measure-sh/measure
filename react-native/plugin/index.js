const { withPodfile } = require('@expo/config-plugins');

const MEASURE_POD_TAG = `# @measure/react-native`;
const MEASURE_POD_LINES = `
${MEASURE_POD_TAG}
  pod 'MeasureReactNative', :path => '../../..', :modular_headers => false
  pod 'measure-sh', :path => '../../../..', :modular_headers => false
`;

const DEDUPE_SCRIPT = `
  # Fix duplicate headers and signing issues
  installer.pods_project.targets.each do |target|
    target.build_phases.each do |phase|
      if phase.respond_to?(:files)
        seen = {}
        phase.files.delete_if do |file|
          ref = file.file_ref
          next false unless ref
          path = ref.real_path.to_s
          if seen[path]
            true
          else
            seen[path] = true
            false
          end
        end
      end
    end
  end
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

function injectPostInstall(contents) {
  if (contents.includes('post_install do |installer|')) {
    if (contents.includes('Fix duplicate headers')) return contents; // Already added

    return contents.replace(
      /(post_install do \|installer\|[\s\S]*?)end/,
      (match) => match.replace(/end$/, `${DEDUPE_SCRIPT}\nend`)
    );
  } else {
    return `${contents}\n\npost_install do |installer|\n${DEDUPE_SCRIPT}\nend\n`;
  }
}

function withMeasure(config) {
  return withPodfile(config, (config) => {
    console.log('[Measure Plugin] running withPodfile');

    let contents = config.modResults.contents;

    contents = injectMeasurePods(contents);
    // contents = injectPostInstall(contents);

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withMeasure;