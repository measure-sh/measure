const path = require('path');
const {getDefaultConfig} = require('@react-native/metro-config');
const exclusionList = require('metro-config/private/defaults/exclusionList').default;

const measureReactNativePath = path.resolve(__dirname, '../../../react-native');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve the symlinked @measuresh/react-native package
// which lives outside this project's directory tree.
config.watchFolders = [measureReactNativePath];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(measureReactNativePath, 'node_modules'),
];

// Force react / react-native to this app's copies. The SDK's own node_modules
// pin older versions; a second react-native in the bundle breaks native module
// lookup at runtime ("PlatformConstants could not be found").
const escapedSdkPath = measureReactNativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = exclusionList([
  new RegExp(`${escapedSdkPath}/node_modules/(react|react-native)/.*`),
]);

// Resolve the Measure RN SDK from its TypeScript `source` instead of compiled
// `lib/`, so SDK edits need no `bob build` and can't go stale. The SDK's
// `exports` map gates source behind the "source" condition, which Metro's
// package-exports resolution only honors when it's an active condition.
config.resolver.unstable_conditionNames = [
  'source',
  ...config.resolver.unstable_conditionNames,
];

module.exports = config;
