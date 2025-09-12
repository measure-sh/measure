import { Measure } from "../measure";
import { MeasureInternal } from "../measureInternal";
import { MeasureConfig } from "../config/measureConfig";
import { ClientInfo, type Client } from "../config/clientInfo";

jest.mock("../measureInitializer");
jest.mock("../measureInternal");

describe("Measure.init", () => {
  let client: Client;
  let config: MeasureConfig;
  let mockInit: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    client = new ClientInfo(
      "test-client-id-ios",
      "test-client-id-android",
      "https://api.example.com"
    );

    config = new MeasureConfig(
      true, 1, 1, false, false, [], [], [], false, true
    );

    // Make init return a real resolved promise
    mockInit = jest.fn(() => Promise.resolve());

    // Mock MeasureInternal implementation
    (MeasureInternal as jest.Mock).mockImplementation(() => ({
      init: mockInit,
      start: jest.fn(),
      stop: jest.fn(),
    }));
  });

  it("should only initialize once", async () => {
    // First call to init
    const firstPromise = Measure.init(client, config);
    expect(mockInit).toHaveBeenCalledTimes(1);

    // Second call to init (should not trigger init again)
    const secondPromise = Measure.init(client, config);
    expect(mockInit).toHaveBeenCalledTimes(1);

    // Both promises should be the same
    expect(secondPromise).toBe(firstPromise);

    // Await the promise to resolve properly
    await firstPromise;
  });
});