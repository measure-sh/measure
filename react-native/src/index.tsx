import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package '@measure/react-native' doesn't seem to be linked properly.` +
  (Platform.OS === 'ios'
    ? `\n\nMake sure you have run 'pod install' in the iOS directory.`
    : `\n\nMake sure you've rebuilt the app after installing the package.`);

const MeasureModule = NativeModules.MeasureModule
  ? NativeModules.MeasureModule
  : new Proxy({}, {
      get() {
        throw new Error(LINKING_ERROR);
      },
    });

/**
 * Initializes the Measure SDK with the given API key.
 * On native side, this should be handled via a bridge call.
 */
export function initialize(apiKey: string) {
  console.log('initialize called with:', apiKey);

  if (MeasureModule.initialize) {
    console.log('native modules called.');
    return MeasureModule.initialize(apiKey);
  } else {
    console.log('could not call native module.')
  }

  // Optional: fallback for dev mode
  return Promise.resolve();
}