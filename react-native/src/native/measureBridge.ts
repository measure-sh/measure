import { NativeModules, Platform } from 'react-native';
import type { Logger } from '../utils/logger';
import type { Client } from '../config/clientInfo';
import type { BaseMeasureConfig } from '../config/measureConfig';

const LINKING_ERROR =
  `The package '@measuresh/react-native' doesn't seem to be linked properly.` +
  (Platform.OS === 'ios'
    ? `\n\nMake sure you have run 'pod install' in the iOS directory.`
    : `\n\nMake sure you've rebuilt the app after installing the package.`);

const MeasureModule = NativeModules.MeasureModule
  ? NativeModules.MeasureModule
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export function initializeNativeSDK(
  client: Client,
  config: BaseMeasureConfig,
  logger: Logger
): void {
  if (MeasureModule.initialize) {
    logger.log(
      'debug',
      '[MeasureBridge] Calling native initialize with API key: ' + client.apiKey // TODO: Remove this log in production
    );

    MeasureModule.initialize(client, config)
      .then((result: any) => {
        logger.log(
          'info',
          '[MeasureBridge] Native initialize returned: ' + result
        );
      })
      .catch((err: any) => {
        logger.log('error', '[MeasureBridge] Native initialize failed: ' + err);
      });
  } else {
    logger.log('error', '[MeasureBridge] Native module not found.');
  }
}

export const start = (): void => {
  MeasureModule.start(); // TODO: add MeasureModule native check
};

export const stop = (): void => {
  MeasureModule.stop(); // TODO: add MeasureModule native check
};