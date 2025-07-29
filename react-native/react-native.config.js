module.exports = {
    dependency: {
      platforms: {
        ios: {
          podspecPath: 'MeasureReactNative.podspec',
        },
        android: {
          packageInstance: 'new MeasureModule()',
        },
      },
    },
  };