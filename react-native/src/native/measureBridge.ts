import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
import type { Logger } from '../utils/logger';
import { ClientInfoInternal, type Client } from '../config/clientInfo';
import type { MeasureConfig } from '../config/measureConfig';
import type { ValidAttributeValue } from '../utils/attributeValueValidator';

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

const { MeasureOnShake } = NativeModules;
const MeasureEventEmitter = new NativeEventEmitter(MeasureOnShake);

export function initializeNativeSDK(
  client: Client,
  config: MeasureConfig,
  logger: Logger
): Promise<any> {
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

function initNativeSDK(
  client: ClientInfoInternal,
  config: MeasureConfig,
  logger: Logger
): Promise<any> {
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
}

export function stop(): Promise<any> {
  return MeasureModule.stop();
}

export function trackEvent(
  data: Record<string, any>,
  type: string,
  timestamp: number,
  attributes: Record<string, any> = {},
  userDefinedAttrs: Record<string, any> = {},
  userTriggered = false,
  sessionId?: string,
  threadName?: string,
  attachments: any[] = []
): Promise<any> {
  if (!MeasureModule.trackEvent) {
    return Promise.reject(new Error('trackEvent native method not available.'));
  }

  return MeasureModule.trackEvent(
    data,
    type,
    timestamp,
    attributes,
    userDefinedAttrs,
    userTriggered,
    sessionId,
    threadName,
    attachments
  );
}

export function trackSpan(
  name: string,
  traceId: string,
  spanId: string,
  parentId: string | null,
  startTime: number,
  endTime: number,
  duration: number,
  status: number,
  attributes: Record<string, any> = {},
  userDefinedAttrs: Record<string, any> = {},
  checkpoints: Record<string, number> = {},
  hasEnded: boolean,
  isSampled: boolean
): Promise<any> {
  if (!MeasureModule.trackSpan) {
    return Promise.reject(new Error('trackSpan native method not available.'));
  }

  return MeasureModule.trackSpan(
    name,
    traceId,
    spanId,
    parentId,
    startTime,
    endTime,
    duration,
    status,
    attributes,
    userDefinedAttrs,
    checkpoints,
    hasEnded,
    isSampled
  );
}

export function setUserId(userId: string): Promise<any> {
  if (!MeasureModule.setUserId) {
    return Promise.reject(new Error('setUserId native method not available.'));
  }
  return MeasureModule.setUserId(userId);
}

export function clearUserId(): Promise<any> {
  if (!MeasureModule.clearUserId) {
    return Promise.reject(new Error('clearUserId native method not available.'));
  }
  return MeasureModule.clearUserId();
}

export function trackHttpEvent(
  url: string,
  method: string,
  startTime: number,
  endTime: number,
  statusCode?: number | null,
  error?: string | null,
  requestHeaders: Record<string, string> = {},
  responseHeaders: Record<string, string> = {},
  requestBody?: string | null,
  responseBody?: string | null,
  client: string = 'unknown'
): Promise<any> {
  if (!MeasureModule.trackHttpEvent) {
    return Promise.reject(
      new Error('trackHttpEvent native method not available.')
    );
  }

  return MeasureModule.trackHttpEvent(
    url,
    method,
    startTime,
    endTime,
    statusCode,
    error,
    requestHeaders,
    responseHeaders,
    requestBody,
    responseBody,
    client
  );
}

export function launchBugReport(
  takeScreenshot: boolean = true,
  bugReportConfig: Record<string, any> = {},
  attributes: Record<string, ValidAttributeValue> = {}
): Promise<void> {
  if (!MeasureModule.launchBugReport) {
    return Promise.reject(
      new Error('launchBugReport native method not available.')
    );
  }

  return MeasureModule.launchBugReport(takeScreenshot, bugReportConfig, attributes);
}

export function setShakeListener(enable: boolean, handler?: () => void): void {
  if (!MeasureModule.setShakeListener) {
    throw new Error('setShakeListener native method not available.');
  }

  MeasureEventEmitter.removeAllListeners('MeasureOnShake');

  if (!enable || !handler) {
    MeasureModule.setShakeListener(false);
    return;
  }

  MeasureModule.setShakeListener(true);

  MeasureEventEmitter.addListener('MeasureOnShake', handler);
}

export function captureScreenshot(): Promise<{
  base64: string;
}> {
  if (!MeasureModule.captureScreenshot) {
    return Promise.reject(
      new Error('captureScreenshot native method not available.')
    );
  }

  return MeasureModule.captureScreenshot();
}
