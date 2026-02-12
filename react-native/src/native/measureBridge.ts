import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
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

let ShakeEmitter: NativeEventEmitter | null = null;

let isNativeModuleEnabled = true;

export function enableNativeModule(): void {
  isNativeModuleEnabled = true;
}

export function disableNativeModule(): void {
  isNativeModuleEnabled = false;
}

function isDisabled(): boolean {
  return !isNativeModuleEnabled;
}

function getShakeEmitter() {
  if (!ShakeEmitter) {
    const native = NativeModules.MeasureOnShake || {};
    ShakeEmitter = new NativeEventEmitter(native);
  }
  return ShakeEmitter;
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
  if (!MeasureModule.trackEvent || isDisabled()) {
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
  if (!MeasureModule.trackSpan || isDisabled()) {
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
  if (!MeasureModule.setUserId || isDisabled()) {
    return Promise.reject(new Error('setUserId native method not available.'));
  }
  return MeasureModule.setUserId(userId);
}

export function clearUserId(): Promise<any> {
  if (!MeasureModule.clearUserId || isDisabled()) {
    return Promise.reject(
      new Error('clearUserId native method not available.')
    );
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
  if (!MeasureModule.trackHttpEvent || isDisabled()) {
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
  if (!MeasureModule.launchBugReport || isDisabled()) {
    return Promise.reject(
      new Error('launchBugReport native method not available.')
    );
  }

  return MeasureModule.launchBugReport(
    takeScreenshot,
    bugReportConfig,
    attributes
  );
}

export function setShakeListener(enable: boolean, handler?: () => void): void {
  if (!MeasureModule.setShakeListener || isDisabled()) {
    throw new Error('setShakeListener native method not available.');
  }

  const emitter = getShakeEmitter();
  emitter.removeAllListeners('MeasureOnShake');

  if (!enable || !handler) {
    MeasureModule.setShakeListener(false);
    return;
  }

  MeasureModule.setShakeListener(true);
  emitter.addListener('MeasureOnShake', handler);
}

export function captureScreenshot(): Promise<{
  name: string;
  type: 'screenshot';
  path: string;
  size: number;
  id: string;
}> {
  if (!MeasureModule.captureScreenshot || isDisabled()) {
    return Promise.reject(
      new Error('captureScreenshot native method not available.')
    );
  }

  return MeasureModule.captureScreenshot();
}

export function captureLayoutSnapshot(): Promise<{
  name: string;
  type: 'layout_snapshot';
  path: string;
  size: number;
  id: string;
}> {
  if (!MeasureModule.captureLayoutSnapshot || isDisabled()) {
    return Promise.reject(
      new Error('captureLayoutSnapshot native method not available.')
    );
  }

  return MeasureModule.captureLayoutSnapshot();
}

export function trackBugReport(
  description: string,
  attachments: any[] = [],
  attributes: Record<string, ValidAttributeValue> = {}
): Promise<void> {
  if (!MeasureModule.trackBugReport || isDisabled()) {
    return Promise.reject(
      new Error('trackBugReport native method not available.')
    );
  }

  return MeasureModule.trackBugReport(description, attachments, attributes);
}

export function getSessionId(): Promise<string | null> {
  if (!MeasureModule.getSessionId || isDisabled()) {
    return Promise.reject(
      new Error('getSessionId native method not available.')
    );
  }

  return MeasureModule.getSessionId();
}

export function getDynamicConfig(): Promise<Record<string, any> | null> {
  if (!MeasureModule.getDynamicConfig || isDisabled()) {
    return Promise.reject(
      new Error('getDynamicConfig native method not available.')
    );
  }

  return MeasureModule.getDynamicConfig();
}