import { buildExceptionPayload } from "../../exception/exceptionBuilder";
import { setupErrorHandlers } from "../../exception/measureErrorHandlers";

jest.mock("../../exception/exceptionBuilder", () => ({
  buildExceptionPayload: jest.fn(() => ({ fake: "payload" })),
}));
jest.mock("../../native/measureBridge", () => ({
  trackEvent: jest.fn(() => Promise.resolve()),
}));

describe("errorHandlers", () => {
  let logger: any;
  let timeProvider: any;

  beforeEach(() => {
    logger = { log: jest.fn(), internalLog: jest.fn() };
    timeProvider = { now: jest.fn(() => 123456) };
    (global as any).ErrorUtils = {
      getGlobalHandler: jest.fn(() => jest.fn()),
      setGlobalHandler: jest.fn(),
    };
  });

  it("installs global error handler", () => {
    setupErrorHandlers({ timeProvider, logger });

    expect((global as any).ErrorUtils.setGlobalHandler).toHaveBeenCalled();

    expect(logger.internalLog).toHaveBeenCalledWith(
      "info",
      "Global error handler installed."
    );
  });

  it("captures an exception and forwards to trackEvent", async () => {
    const handler = jest.fn();
    (global as any).ErrorUtils.getGlobalHandler.mockReturnValue(handler);

    setupErrorHandlers({ timeProvider, logger });

    expect((global as any).ErrorUtils.setGlobalHandler).toHaveBeenCalled();

    const [setHandler] = ((global as any).ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0];
    const err = new Error("Something went wrong");

    setHandler(err, true);

    expect(buildExceptionPayload).toHaveBeenCalledWith(err, false);
    expect(logger.log).toHaveBeenCalledWith(
      "fatal",
      "Fatal exception",
      err,
      { fake: "payload" }
    );
  });
});