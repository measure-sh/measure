import { NativeModules, Platform } from 'react-native';
import type { Logger } from '../utils/logger';
import { ClientInfoInternal, type Client } from '../config/clientInfo';
import type { MeasureConfig } from '../config/measureConfig';

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

export function initializeNativeSDK(client: Client, config: MeasureConfig, logger: Logger): Promise<any> {
  if (MeasureModule.initialize) {
    let clientInfo: ClientInfoInternal;
    if (Platform.OS === 'ios') {
      clientInfo = new ClientInfoInternal(client.apiKeyIos, client.apiUrl);
    } else {
      clientInfo = new ClientInfoInternal(client.apiKeyAndroid, client.apiUrl);
    }
    return initNativeSDK(clientInfo, config, logger);
  } else {
    logger.log('error', '[MeasureBridge] Native module not found.');
    return Promise.reject(
      new Error('[MeasureBridge] Native module not found.')
    );
  }
}

function initNativeSDK(client: ClientInfoInternal, config: MeasureConfig, logger: Logger): Promise<any> {
  return MeasureModule.initialize(client, config)
    .then((result: any) => {
      logger.log(
        'info',
        '[MeasureBridge] Native initialize returned: ' + result
      );
      return result;
    })
    .catch((err: any) => {
      logger.log('error', '[MeasureBridge] Native initialize failed: ' + err);
      throw err;
    });
}

export function start(): Promise<any> {
  return MeasureModule.start();
};

export function stop(): Promise<any> {
  return MeasureModule.stop();
};