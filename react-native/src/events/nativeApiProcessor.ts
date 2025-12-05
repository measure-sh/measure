import { clearUserId, setUserId } from '../native/measureBridge';
import type { Logger } from '../utils/logger';

export interface INativeApiProcessor {
  setUserId(userId: string): void;
  clearUserId(): void;
}

export class NativeApiProcessor implements INativeApiProcessor {
  private logger: Logger;

  constructor(opts: { logger: Logger }) {
    this.logger = opts.logger;
  }

  setUserId(userId: string): void {
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      this.logger.log(
        'warning',
        '[NativeApiProcessor] setUserId called with invalid userId.'
      );
      return;
    }

    try {
      setUserId(userId).catch((err: any) => {
        this.logger.log(
          'error',
          `[NativeApiProcessor] Failed to set userId in native SDK: ${err}`
        );
      });
    } catch (err) {
      this.logger.log(
        'error',
        `[NativeApiProcessor] setUserId threw synchronously: ${err}`
      );
    }
  }

  clearUserId(): void {
    try {
      clearUserId().catch((err: any) => {
        this.logger.log(
          'error',
          `[NativeApiProcessor] Failed to clear userId in native SDK: ${err}`
        );
      });
    } catch (err) {
      this.logger.log(
        'error',
        `[NativeApiProcessor] clearUserId threw synchronously: ${err}`
      );
    }
  }
}
