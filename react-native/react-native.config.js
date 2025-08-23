module.exports = {
    dependency: {
      platforms: {
        ios: {
          podspecPath: 'MeasureReactNative.podspec',
        },
        android: {
          packageInstance: 'new MeasureModule()',
          packageImportPath: 'import sh.measure.rn.MeasurePackage;',
        },
      },
    },
  };