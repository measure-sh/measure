import { DefaultConfig } from './defaultConfig';
import type { InternalConfig } from './internalConfig';
import type { IMeasureConfig } from './measureConfig';

export class Config implements InternalConfig, IMeasureConfig {
  enableLogging: boolean;
  autoStart: boolean;
  enableFullCollectionMode: boolean;
  maxCheckpointsPerSpan: number;
  maxCheckpointNameLength: number;
  maxSpanNameLength: number;
  maxEventNameLength: number;
  customEventNameRegex: string;

  constructor(
    enableLogging?: boolean,
    autoStart?: boolean,
    enableFullCollectionMode?: boolean
  ) {
    this.enableLogging = enableLogging ?? DefaultConfig.enableLogging;
    this.autoStart = autoStart ?? DefaultConfig.autoStart;
    this.enableFullCollectionMode = enableFullCollectionMode ?? DefaultConfig.enableFullCollectionMode;
    this.maxEventNameLength = 64;
    this.customEventNameRegex = DefaultConfig.customEventNameRegex;
    this.maxSpanNameLength = 64;
    this.maxCheckpointNameLength = 64;
    this.maxCheckpointsPerSpan = 100;
  }
}