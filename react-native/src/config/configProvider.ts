// ConfigProvider.ts

import { Config } from './config';
import type { IMeasureConfig } from './measureConfig';
import type { InternalConfig } from './internalConfig';
import { DynamicConfig, type IDynamicConfig } from './dynamicConfig';
import type { ScreenshotMaskLevel } from './screenshotMaskLevel';

/**
 * Configuration Provider for the Measure SDK.
 * See `BaseConfigProvider` for details.
 */
export interface IConfigProvider extends IMeasureConfig, InternalConfig, IDynamicConfig {
  setDynamicConfig(config: IDynamicConfig): void;
}

/**
 * A configuration provider for the Measure SDK.
 *
 * The `ConfigProvider` class is responsible for managing and providing configuration settings
 * for the Measure SDK. It follows a priority hierarchy to determine the most up-to-date configuration:
 *
 * 1. Network Configuration: If a network configuration is available, it takes precedence.
 * 2. Cached Configuration: If no network config is available, the cached config is used.
 * 3. Default Configuration: Fallback if neither network nor cached config is available.
 */
export class ConfigProvider implements IConfigProvider {
  private defaultConfig: Config;
  private dynamicConfig: IDynamicConfig = DynamicConfig.default();

  constructor(defaultConfig: Config) {
    this.defaultConfig = defaultConfig;
  }
  
  get maxEventsInBatch(): number {
    return this.dynamicConfig.maxEventsInBatch;
  }

  get crashTimelineDurationSeconds(): number {
    return this.dynamicConfig.crashTimelineDurationSeconds;
  }

  get anrTimelineDurationSeconds(): number {
    return this.dynamicConfig.anrTimelineDurationSeconds;
  }

  get bugReportTimelineDurationSeconds(): number {
    return this.dynamicConfig.bugReportTimelineDurationSeconds;
  }

  get traceSamplingRate(): number {
    return this.dynamicConfig.traceSamplingRate;
  }

  get journeySamplingRate(): number {
    return this.dynamicConfig.journeySamplingRate;
  }

  get screenshotMaskLevel(): ScreenshotMaskLevel {
    return this.dynamicConfig.screenshotMaskLevel;
  }

  get cpuUsageInterval(): number {
    return this.dynamicConfig.cpuUsageInterval;
  }

  get memoryUsageInterval(): number {
    return this.dynamicConfig.memoryUsageInterval;
  }

  get crashTakeScreenshot(): boolean {
    return this.dynamicConfig.crashTakeScreenshot;
  }

  get anrTakeScreenshot(): boolean {
    return this.dynamicConfig.anrTakeScreenshot;
  }

  get launchSamplingRate(): number {
    return this.dynamicConfig.launchSamplingRate;
  }

  get gestureClickTakeSnapshot(): boolean {
    return this.dynamicConfig.gestureClickTakeSnapshot;
  }

  get httpDisableEventForUrls(): string[] {
    return this.dynamicConfig.httpDisableEventForUrls;
  }

  get httpTrackRequestForUrls(): string[] {
    return this.dynamicConfig.httpTrackRequestForUrls;
  }

  get httpTrackResponseForUrls(): string[] {
    return this.dynamicConfig.httpTrackResponseForUrls;
  }

  get httpBlockedHeaders(): string[] {
    return this.dynamicConfig.httpBlockedHeaders;
  }

  get enableLogging(): boolean {
    return this.defaultConfig.enableLogging;
  }

  get autoStart(): boolean {
    return this.defaultConfig.autoStart;
  }

  get enableFullCollectionMode(): boolean {
    return this.defaultConfig.enableFullCollectionMode;
  }

  get maxEventNameLength(): number {
    return this.defaultConfig.maxEventNameLength;
  }

  get customEventNameRegex(): string {
    return this.defaultConfig.customEventNameRegex;
  }

  get maxSpanNameLength(): number {
    return this.defaultConfig.maxSpanNameLength;
  }

  get maxCheckpointNameLength(): number {
    return this.defaultConfig.maxCheckpointNameLength;
  }

  get maxCheckpointsPerSpan(): number {
    return this.defaultConfig.maxCheckpointsPerSpan;
  }

  setDynamicConfig(config: IDynamicConfig): void {
    this.dynamicConfig = config;
  }
}
