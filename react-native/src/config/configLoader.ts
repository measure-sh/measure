import { getDynamicConfig } from '../native/measureBridge';
import type { Logger } from '../utils/logger';
import { DynamicConfig } from './dynamicConfig';

export class ConfigLoader {
  constructor(private logger: Logger) {}

  async loadDynamicConfig(): Promise<DynamicConfig | null> {
    let json: Record<string, any> | null = null;

    try {
      json = await getDynamicConfig();
    } catch (e) {
      this.logger.log(
        'info',
        'ConfigLoader: Failed to load dynamic config',
        e
      );
      return null;
    }

    if (!json) {
      this.logger.log(
        'info',
        'ConfigLoader: No dynamic config found, using defaults'
      );
      return null;
    }

      this.logger.log(
        'info',
        'ConfigLoader: Dynamic config loaded successfully'
      );
      console.log('Loaded dynamic config:', json);

      return DynamicConfig.fromNative(json);
  }
}