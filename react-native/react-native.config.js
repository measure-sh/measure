module.exports = {
    dependency: {
      platforms: {
        ios: {
          podspecPath: 'MeasureReactNative.podspec',
        },
        android: {
          packageInstance: 'new MeasurePackage()',
          packageImportPath: 'import sh.measure.rn.MeasurePackage;',
        },
      },
    },
  };