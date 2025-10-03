import type { Client } from './config/clientInfo';
import { Config } from './config/config';
import { BaseConfigLoader, type ConfigLoader } from './config/configLoader';
import {
  BaseConfigProvider,
  type ConfigProvider,
} from './config/configProvider';
import { MeasureConfig } from './config/measureConfig';
import { MeasureLogger, type Logger } from './utils/logger';
import { MeasureTimeProvider, type TimeProvider } from './utils/timeProvider';
import { CustomEventCollector } from './events/customEventCollector';

export interface MeasureInitializer {
  logger: Logger;
  client: Client;
  configProvider: ConfigProvider;
  configLoader: ConfigLoader;
  config: Config;
  timeProvider: TimeProvider;
  customEventCollector: CustomEventCollector;
}

export class BaseMeasureInitializer implements MeasureInitializer {
  logger: Logger;
  client: Client;
  configProvider: ConfigProvider;
  configLoader: ConfigLoader;
  config: Config;
  timeProvider: TimeProvider;
  customEventCollector: CustomEventCollector;

  constructor(client: Client, config: MeasureConfig | null) {
    this.logger = new MeasureLogger(
      'Measure',
      config?.enableLogging ?? true,
      true
    );
    this.client = client;
    this.config = new Config(
      config?.enableLogging,
      config?.samplingRateForErrorFreeSessions,
      config?.traceSamplingRate,
      config?.trackHttpHeaders,
      config?.trackHttpBody,
      config?.httpHeadersBlocklist,
      config?.httpUrlBlocklist,
      config?.httpUrlAllowlist,
      config?.autoStart,
      config?.trackViewControllerLoadTime
    );
    this.configLoader = new BaseConfigLoader();
    this.configProvider = new BaseConfigProvider(
      this.config,
      this.configLoader
    );
    this.timeProvider = new MeasureTimeProvider();
    this.customEventCollector = new CustomEventCollector({
      logger: this.logger,
      timeProvider: this.timeProvider,
      configProvider: this.configProvider,
    });
  }
}