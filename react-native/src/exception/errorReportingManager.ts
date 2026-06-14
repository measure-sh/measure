import type { Logger } from '../utils/logger';
import { buildExceptionPayload } from './exceptionBuilder';
import type { TimeProvider } from '../utils/timeProvider';
import type { ISignalProcessor } from '../events/signalProcessor';

export class ErrorReportingManager {
  private readonly timeProvider: TimeProvider;
  private readonly logger: Logger;
  private readonly signalProcessor: ISignalProcessor;

  private defaultErrorHandler:
    | ((error: any, isFatal?: boolean) => void)
    | undefined;
  private isEnabled = false;
  private usingPolyfill = false;

  constructor(
    timeProvider: TimeProvider,
    logger: Logger,
    signalProcessor: ISignalProcessor
  ) {
    this.timeProvider = timeProvider;
    this.logger = logger;
    this.signalProcessor = signalProcessor;
  }

  enable(): void {
    if (this.isEnabled) {
      return;
    }
    this.isEnabled = true;
    this.installGlobalErrorHandler();
    this.installRejectionHandler();
    this.logger.internalLog('info', 'React Native error handlers installed.');
  }

  disable(): void {
    if (!this.isEnabled) {
      return;
    }
    this.isEnabled = false;
    this.restoreGlobalErrorHandler();
    this.uninstallRejectionHandler();
    this.logger.internalLog('info', 'React Native error handlers removed.');
  }

  private async captureException(
    error: unknown,
    isFatal: boolean
  ): Promise<void> {
    if (!this.isEnabled) {
      return;
    }
    try {
      const severity = isFatal ? 'fatal' : 'unhandled';
      const exceptionPayload = buildExceptionPayload(error, severity);

      if (error instanceof Error && error.stack) {
        this.logger.log(
          'debug',
          `[ErrorHandler] Raw stacktrace:\n${error.stack}`
        );
      }
      this.logger.log(
        'debug',
        `[ErrorHandler] Exception payload:\n${JSON.stringify(exceptionPayload, null, 2)}`
      );

      this.logger.log(
        isFatal ? 'fatal' : 'error',
        isFatal ? 'Fatal exception' : 'Exception',
        error,
        exceptionPayload
      );

      await this.signalProcessor.trackEvent(
        exceptionPayload,
        'exception',
        this.timeProvider.now()
      );
    } catch (e) {
      this.logger.log('error', 'Failed to process exception', e);
    }
  }

  private installGlobalErrorHandler(): void {
    const errorUtils = (global as any).ErrorUtils;
    if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) {
      this.logger.log(
        'warning',
        'ErrorUtils not found. Skipping global error handler setup.'
      );
      return;
    }

    this.defaultErrorHandler = errorUtils.getGlobalHandler();

    errorUtils.setGlobalHandler(async (error: any, isFatal?: boolean) => {
      if (isFatal === true) {
        await this.captureException(error, true);
      }
      if (this.defaultErrorHandler) {
        this.defaultErrorHandler(error, isFatal);
      }
    });

    this.logger.internalLog('info', 'Global error handler installed.');
  }

  private restoreGlobalErrorHandler(): void {
    const errorUtils = (global as any).ErrorUtils;
    if (!errorUtils?.setGlobalHandler) {
      return;
    }
    if (this.defaultErrorHandler) {
      errorUtils.setGlobalHandler(this.defaultErrorHandler);
      this.defaultErrorHandler = undefined;
      this.logger.internalLog('info', 'Global error handler restored.');
    }
  }

  private installRejectionHandler(): void {
    try {
      const hermes = (global as any).HermesInternal;

      if (
        hermes?.enablePromiseRejectionTracker &&
        typeof hermes.hasPromise === 'function' &&
        hermes.hasPromise()
      ) {
        hermes.enablePromiseRejectionTracker({
          allRejections: true,
          onUnhandled: (_id: string, error: unknown) => {
            this.captureException(error, false);
          },
        });
        this.logger.internalLog(
          'info',
          'Using Hermes promise rejection tracking.'
        );
      } else {
        const rejectionTracking = require('promise/setimmediate/rejection-tracking');
        rejectionTracking.enable({
          allRejections: true,
          onUnhandled: (_id: string, error: unknown) => {
            this.captureException(error, false);
          },
        });
        this.usingPolyfill = true;
        this.logger.internalLog(
          'info',
          'Using polyfill for promise rejection tracking.'
        );
      }
    } catch (e) {
      this.logger.log(
        'error',
        'Failed to set up promise rejection tracking',
        e
      );
    }
  }

  private uninstallRejectionHandler(): void {
    // Hermes promise rejection tracker has no uninstall API — the isEnabled
    // guard in captureException ensures events are silently dropped when disabled.
    if (this.usingPolyfill) {
      try {
        const rejectionTracking = require('promise/setimmediate/rejection-tracking');
        rejectionTracking.disable();
        this.usingPolyfill = false;
        this.logger.internalLog(
          'info',
          'Polyfill promise rejection tracking disabled.'
        );
      } catch (e) {
        this.logger.log(
          'error',
          'Failed to disable polyfill promise rejection tracking',
          e
        );
      }
    }
  }
}
