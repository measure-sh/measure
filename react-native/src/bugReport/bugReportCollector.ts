import type { Logger } from '../utils/logger';
import type { ValidAttributeValue } from '../utils/attributeValueValidator';
import { launchBugReport } from '../native/measureBridge';

export interface IBugReportCollector {
  /**
   * Registers the collector.
   */
  register(): void;

  /**
   * Unregisters the collector.
   */
  unregister(): void;

  /**
   * Launches the bug report flow.
   *
   * @param takeScreenshot - Whether to include a screenshot in the report.
   * @param bugReportConfig - Optional configuration for the bug report UI.
   * @param attributes - Optional metadata about the bug or context.
   */
  launchBugReport(
    takeScreenshot?: boolean,
    bugReportConfig?: Record<string, any>,
    attributes?: Record<string, ValidAttributeValue>
  ): Promise<void>;
}

/**
 * BugReportCollector
 *
 * Default implementation of IBugReportCollector.
 * Handles launching the bug report flow and managing its lifecycle.
 */
export class BugReportCollector implements IBugReportCollector {
  private logger: Logger;
  private isRegistered = false;

  constructor(opts: {
    logger: Logger;
  }) {
    this.logger = opts.logger;
  }

  register(): void {
    if (this.isRegistered) {
      this.logger.internalLog('debug', '[BugReportCollector] Already registered.');
      return;
    }

    this.isRegistered = true;
    this.logger.internalLog('info', '[BugReportCollector] Registered.');
  }

  unregister(): void {
    if (!this.isRegistered) {
      this.logger.internalLog('debug', '[BugReportCollector] Not registered.');
      return;
    }

    this.isRegistered = false;
    this.logger.internalLog('info', '[BugReportCollector] Unregistered.');
  }

  async launchBugReport(
    takeScreenshot: boolean = true,
    bugReportConfig: Record<string, any> = {},
    attributes: Record<string, ValidAttributeValue> = {}
  ): Promise<void> {
    if (!this.isRegistered) {
      this.logger.internalLog(
        'warning',
        '[BugReportCollector] Called before registration. Proceeding anyway.'
      );
    }

    this.logger.internalLog('info', '[BugReportCollector] Launching bug report...', {
      takeScreenshot,
      bugReportConfig,
      attributes,
    });

    launchBugReport(takeScreenshot, bugReportConfig, attributes);
  }
}