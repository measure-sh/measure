const path = require('path');
const {getDefaultConfig} = require('@react-native/metro-config');

const measureReactNativePath = path.resolve(__dirname, '../../../react-native');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve the symlinked @measuresh/react-native package
// which lives outside this project's directory tree.
config.watchFolders = [measureReactNativePath];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(measureReactNativePath, 'node_modules'),
];

// Prefer "source" entry point so the Measure RN SDK is resolved from
// TypeScript source instead of requiring a prior `npx bob build`.
config.resolver.resolverMainFields = ['source', 'react-native', 'browser', 'main'];

module.exports = config;
