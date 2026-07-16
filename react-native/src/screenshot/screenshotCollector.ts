import type { Logger } from '../utils/logger';
import type { MsrAttachment } from '../events/msrAttachment';
import { captureScreenshot } from '../native/measureBridge';

export interface IScreenshotCollector {
  capture(): Promise<MsrAttachment | null>;
}

export class ScreenshotCollector implements IScreenshotCollector {
  private logger: Logger;

  constructor(opts: { logger: Logger }) {
    this.logger = opts.logger;
  }

  async capture(): Promise<MsrAttachment | null> {
    try {
      const attachment = await captureScreenshot();

      return attachment as MsrAttachment;
    } catch (err) {
      this.logger.internalLog(
        'warning',
        `[ScreenshotCollector] capture failed: ${err}`
      );
      return null;
    }
  }
}
