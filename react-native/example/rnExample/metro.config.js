const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

module.exports = mergeConfig(defaultConfig, {
  watchFolders: [
    path.resolve(__dirname, '../..') // watch the monorepo root
  ],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, '../../node_modules')
    ],
    extraNodeModules: {
      '@measure/react-native': path.resolve(__dirname, '../../') // local link
    }
  }
});