import { buildExceptionPayload } from "../../exception/exceptionBuilder";
import { ErrorReportingManager } from "../../exception/errorReportingManager";

jest.mock("../../exception/exceptionBuilder", () => ({
  buildExceptionPayload: jest.fn(() => ({ fake: "payload" })),
}));
jest.mock("../../native/measureBridge", () => ({
  trackEvent: jest.fn(() => Promise.resolve()),
}));

describe("ErrorReportingManager", () => {
  let logger: any;
  let timeProvider: any;
  let signalProcessor: any;
  let manager: ErrorReportingManager;

  beforeEach(() => {
    logger = { log: jest.fn(), internalLog: jest.fn() };
    timeProvider = { now: jest.fn(() => 123456) };
    signalProcessor = { trackEvent: jest.fn(() => Promise.resolve()) };
    (global as any).ErrorUtils = {
      getGlobalHandler: jest.fn(() => jest.fn()),
      setGlobalHandler: jest.fn(),
    };
    (buildExceptionPayload as jest.Mock).mockClear();
    manager = new ErrorReportingManager(timeProvider, logger, signalProcessor);
  });

  it("installs global error handler on enable", () => {
    manager.enable();

    expect((global as any).ErrorUtils.setGlobalHandler).toHaveBeenCalled();
    expect(logger.internalLog).toHaveBeenCalledWith("info", "Global error handler installed.");
  });

  it("is idempotent — calling enable twice installs handler only once", () => {
    manager.enable();
    manager.enable();

    expect((global as any).ErrorUtils.setGlobalHandler).toHaveBeenCalledTimes(1);
  });

  it("captures a fatal exception and forwards to trackEvent", async () => {
    const previousHandler = jest.fn();
    (global as any).ErrorUtils.getGlobalHandler.mockReturnValue(previousHandler);

    manager.enable();

    const [installedHandler] = ((global as any).ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0];
    const err = new Error("Something went wrong");

    await installedHandler(err, true);

    expect(buildExceptionPayload).toHaveBeenCalledWith(err, "fatal");
    expect(logger.log).toHaveBeenCalledWith("fatal", "Fatal exception", err, { fake: "payload" });
    expect(signalProcessor.trackEvent).toHaveBeenCalled();
  });

  it("does not capture when isFatal is undefined", async () => {
    manager.enable();

    const [installedHandler] = ((global as any).ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0];
    await installedHandler(new Error("Non-fatal"), undefined);

    expect(buildExceptionPayload).not.toHaveBeenCalled();
  });

  it("does not capture when isFatal is false", async () => {
    manager.enable();

    const [installedHandler] = ((global as any).ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0];
    await installedHandler(new Error("Non-fatal"), false);

    expect(buildExceptionPayload).not.toHaveBeenCalled();
  });

  it("restores the original handler on disable", () => {
    const previousHandler = jest.fn();
    (global as any).ErrorUtils.getGlobalHandler.mockReturnValue(previousHandler);

    manager.enable();
    manager.disable();

    const lastCall = ((global as any).ErrorUtils.setGlobalHandler as jest.Mock).mock.calls.at(-1);
    expect(lastCall[0]).toBe(previousHandler);
  });

  it("drops exceptions silently after disable", async () => {
    manager.enable();

    const [installedHandler] = ((global as any).ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0];
    manager.disable();

    await installedHandler(new Error("After stop"), true);

    expect(buildExceptionPayload).not.toHaveBeenCalled();
  });

  it("is idempotent — calling disable twice does not throw", () => {
    manager.enable();
    manager.disable();
    expect(() => manager.disable()).not.toThrow();
  });
});
