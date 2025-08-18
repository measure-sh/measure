// ConfigProvider.ts

import { Config } from './config';
import type { ConfigLoader } from './configLoader';
import type { MeasureConfigInterface } from './measureConfig';
import type { InternalConfig } from './internalConfig';

/**
 * Configuration Provider for the Measure SDK.
 * See `BaseConfigProvider` for details.
 */
export interface ConfigProvider extends MeasureConfigInterface, InternalConfig {
  loadNetworkConfig(): void;
}

/**
 * A configuration provider for the Measure SDK.
 *
 * The `BaseConfigProvider` class is responsible for managing and providing configuration settings
 * for the Measure SDK. It follows a priority hierarchy to determine the most up-to-date configuration:
 *
 * 1. Network Configuration: If a network configuration is available, it takes precedence.
 * 2. Cached Configuration: If no network config is available, the cached config is used.
 * 3. Default Configuration: Fallback if neither network nor cached config is available.
 */
export class BaseConfigProvider implements ConfigProvider {
  private defaultConfig: Config;
  private configLoader: ConfigLoader;
  private cachedConfig?: Config | null;
  private networkConfig?: Config;

  constructor(defaultConfig: Config, configLoader: ConfigLoader) {
    this.defaultConfig = defaultConfig;
    this.configLoader = configLoader;
    this.cachedConfig = configLoader.getCachedConfig();
  }

  private getMergedConfig<K extends keyof Config>(key: K): Config[K] {
    if (this.networkConfig && this.networkConfig[key] !== undefined) {
      return this.networkConfig[key];
    } else if (this.cachedConfig && this.cachedConfig[key] !== undefined) {
      return this.cachedConfig[key];
    } else {
      return this.defaultConfig[key];
    }
  }

  loadNetworkConfig(): void {
    this.configLoader.getNetworkConfig((config: Config) => {
      this.networkConfig = config;
    });
  }

  get enableLogging(): boolean {
    return this.getMergedConfig('enableLogging');
  }

  get samplingRateForErrorFreeSessions(): number {
    return this.getMergedConfig('samplingRateForErrorFreeSessions');
  }

  get traceSamplingRate(): number {
    return this.getMergedConfig('traceSamplingRate');
  }

  get trackHttpHeaders(): boolean {
    return this.getMergedConfig('trackHttpHeaders');
  }

  get autoStart(): boolean {
    return this.getMergedConfig('autoStart');
  }

  get trackHttpBody(): boolean {
    return this.getMergedConfig('trackHttpBody');
  }

  get httpHeadersBlocklist(): string[] {
    return this.getMergedConfig('httpHeadersBlocklist');
  }
  
  get httpUrlBlocklist(): string[] {
    return this.getMergedConfig('httpUrlBlocklist');
  }

  get httpUrlAllowlist(): string[] {
    return this.getMergedConfig('httpUrlAllowlist');
  }

  get trackViewControllerLoadTime(): boolean {
    return this.getMergedConfig('trackViewControllerLoadTime');
  }

  get maxEventNameLength(): number {
    return this.getMergedConfig('maxEventNameLength');
  }
}
