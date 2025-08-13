import type { Client } from './config/clientInfo';
import { DefaultConfig } from './config/defaultConfig';
import { MeasureConfig } from './config/measureConfig';
import type { MeasureInitializer } from './measureInitializer';
import { initializeNativeSDK, start, stop } from './native/measureBridge';

export class MeasureInternal {
  private measureInitializer: MeasureInitializer;

  constructor(measureInitializer: MeasureInitializer) {
    this.measureInitializer = measureInitializer;
  }

  init(client: Client, config: MeasureConfig | null): Promise<any> {
    return initializeNativeSDK(
      client,
      config ??
        new MeasureConfig(
          DefaultConfig.enableLogging,
          DefaultConfig.sessionSamplingRate,
          DefaultConfig.traceSamplingRate,
          DefaultConfig.trackHttpHeaders,
          DefaultConfig.trackHttpBody,
          DefaultConfig.httpHeadersBlocklist,
          DefaultConfig.httpUrlBlocklist,
          DefaultConfig.httpUrlAllowlist,
          DefaultConfig.autoStart,
          DefaultConfig.trackViewControllerLoadTime
        ),
      this.measureInitializer.logger
    );
  }

  start = (): Promise<any> => {
    return start();
  };

  stop = (): Promise<any> => {
    return stop();
  };
}
