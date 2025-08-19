const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withMetroConfig } = require('react-native-monorepo-config');

// Get the monorepo root path
const monorepoRoot = path.resolve(__dirname, '../..');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

// Use withMetroConfig to automatically handle monorepo configuration
const config = withMetroConfig(defaultConfig, {
  root: monorepoRoot,
  dirname: __dirname,
});

config.resolver.unstable_enablePackageExports = true;

module.exports = config;
