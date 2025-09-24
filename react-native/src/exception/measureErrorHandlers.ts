import type { Logger } from "../utils/logger";
import { buildExceptionPayload } from "./exceptionBuilder";
import { trackEvent } from "../native/measureBridge";
import type { TimeProvider } from "../utils/timeProvider";

interface Options {
  onerror?: boolean;
  onunhandledrejection?: boolean;
  patchGlobalPromise?: boolean;
  timeProvider: TimeProvider;
  logger: Logger;
}

const DEFAULTS: Omit<Required<Options>, "timeProvider" | "logger"> = {
  onerror: true,
  onunhandledrejection: true,
  patchGlobalPromise: true,
};

let defaultErrorHandler: ((error: any, isFatal?: boolean) => void) | undefined;

/**
 * Initialize React Native global crash & exception tracking
 */
export function setupErrorHandlers(options: Options): void {
  const { timeProvider, logger, ...rest } = options;
  const merged = { ...DEFAULTS, ...rest };
  const log: Logger = logger

  if (merged.onerror) {
    setupGlobalErrorHandler(timeProvider, log);
  }

  if (merged.onunhandledrejection) {
    setupUnhandledRejectionHandler(merged.patchGlobalPromise, timeProvider, log);
  }
}

/**
 * Common function to capture, log and forward exceptions
 */
function captureException(error: unknown, isFatal: boolean, timeProvider: TimeProvider, logger: Logger): void {
  try {
    const exceptionPayload = buildExceptionPayload(error, false);

    logger.log(
      isFatal ? "fatal" : "error",
      isFatal ? "Fatal exception" : "Exception",
      error,
      exceptionPayload
    );

    trackEvent(
      exceptionPayload,
      "exception",
      timeProvider.now(),
      {},
      {},
      false
    ).catch((err) => {
      logger.log("error", "Failed to send exception to native", err);
    });
  } catch (e) {
    logger.log("error", "Failed to process exception", e);
  }
}

/**
 * Hook into React Native's global ErrorUtils handler
 */
function setupGlobalErrorHandler(timeProvider: TimeProvider, logger: Logger): void {
  const errorUtils = (global as any).ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) {
    logger.log(
      "warning",
      "ErrorUtils not found. Skipping global error handler setup."
    );
    return;
  }

  defaultErrorHandler = errorUtils.getGlobalHandler();

  errorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    captureException(error, !!isFatal, timeProvider, logger);

    if (defaultErrorHandler) {
      defaultErrorHandler(error, isFatal);
    }
  });

  logger.internalLog("info", "Global error handler installed.");
}

/**
 * Setup unhandled Promise rejection tracking
 */
function setupUnhandledRejectionHandler(
  patchGlobalPromise: boolean,
  timeProvider: TimeProvider,
  logger: Logger
): void {
  try {
    const hermes = (global as any).HermesInternal;

    if (hermes?.enablePromiseRejectionTracker && typeof hermes.hasPromise === "function" && hermes.hasPromise()) {
      hermes.enablePromiseRejectionTracker({
        allRejections: true,
        onUnhandled: (_id: string, error: unknown) => captureException(error, false, timeProvider, logger),
        onHandled: (id: string) => logger.internalLog("debug", `Promise rejection handled (id: ${id})`),
      });
      logger.internalLog("info", "Using Hermes promise rejection tracking.");
    } else if (patchGlobalPromise) {
      const rejectionTracking = require("promise/setimmediate/rejection-tracking");
      rejectionTracking.enable({
        allRejections: true,
        onUnhandled: (_id: string, error: unknown) => captureException(error, false, timeProvider, logger),
        onHandled: (id: string) => logger.internalLog("debug", `Promise rejection handled (id: ${id})`),
      });
      logger.internalLog("info", "Using polyfill for promise rejection tracking.");
    } else {
      logger.internalLog("warning", "Unhandled promise rejection tracking disabled.");
    }
  } catch (e) {
    logger.log("error", "Failed to set up promise rejection tracking", e);
  }
}