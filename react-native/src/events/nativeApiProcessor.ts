import {
  clearUserId,
  internalSetPatch,
  setUserId,
} from '../native/measureBridge';
import type { Logger } from '../utils/logger';
import { UUID_REGEX, ValidationLimits } from '../utils/validationLimits';

export interface INativeApiProcessor {
  setUserId(userId: string): void;
  clearUserId(): void;
  internalSetPatch(patchId: string, patchVersion?: string): void;
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

    if (userId.length > ValidationLimits.userId) {
      this.logger.log(
        'error',
        `[NativeApiProcessor] User ID exceeds maximum length of ${ValidationLimits.userId} characters and will be ignored.`
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

  internalSetPatch(patchId: string, patchVersion?: string): void {
    if (typeof patchId !== 'string' || patchId.trim().length === 0) {
      this.logger.log(
        'warning',
        '[NativeApiProcessor] internalSetPatch called with invalid patchId.'
      );
      return;
    }

    if (!UUID_REGEX.test(patchId)) {
      this.logger.log(
        'error',
        `[NativeApiProcessor] Patch ID ${patchId} is not a valid UUID and will be ignored.`
      );
      return;
    }

    const sanitizedPatchVersion = patchVersion?.slice(
      0,
      ValidationLimits.patchVersion
    );

    try {
      internalSetPatch(patchId, sanitizedPatchVersion).catch((err: any) => {
        this.logger.log(
          'error',
          `[NativeApiProcessor] Failed to set patch in native SDK: ${err}`
        );
      });
    } catch (err) {
      this.logger.log(
        'error',
        `[NativeApiProcessor] internalSetPatch threw synchronously: ${err}`
      );
    }
  }
}
