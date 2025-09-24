import type { Client } from "./config/clientInfo";
import { Config } from "./config/config";
import { BaseConfigLoader, type ConfigLoader } from "./config/configLoader";
import { BaseConfigProvider, type ConfigProvider } from "./config/configProvider";
import { MeasureConfig } from "./config/measureConfig";
import { MeasureLogger, type Logger } from "./utils/logger";
import { MeasureTimeProvider, type TimeProvider } from "./utils/timeProvider";

export interface MeasureInitializer {
    logger: Logger
    client: Client
    configProvider: ConfigProvider
    configLoader: ConfigLoader
    config: Config
    timeProvider: TimeProvider;
}

export class BaseMeasureInitializer implements MeasureInitializer {
    logger: Logger;
    client: Client;
    configProvider: ConfigProvider;
    configLoader: ConfigLoader;
    config: Config;
    timeProvider: TimeProvider;

    constructor(client: Client, config: MeasureConfig | null) {
        this.logger = new MeasureLogger("Measure", config?.enableLogging ?? true, true);
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
        this.configProvider = new BaseConfigProvider(this.config, this.configLoader);
        this.timeProvider = new MeasureTimeProvider();
    }
}