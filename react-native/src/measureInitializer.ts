import type { Client } from "./config/clientInfo";
import { MeasureLogger, type Logger } from "./utils/logger";

export interface MeasureInitializer {
    logger: Logger
    client: Client
}

export class BaseMeasureInitializer implements MeasureInitializer {
    logger: Logger;
    client: Client;

    constructor(client: Client) {
        this.logger = new MeasureLogger("Measure", true, false);
        this.client = client;
    }
}