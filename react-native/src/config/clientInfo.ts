/**
 * Default API URL for the Measure backend.
 */
const FALLBACK_API_URL = 'https://api.measure.sh';

/**
 * Interface defining the required client information.
 */
export interface Client {
  /** The API key assigned to your iOS project. Available in the Measure dashboard. */
  apiKeyIos: string;

  /** The API key assigned to your Android project. Available in the Measure dashboard. */
  apiKeyAndroid: string;
  
  /** 
   * The backend URL where data will be sent. For self-host users this is available 
   * in the Measure dashboard. For SaaS users this is set automatically.
   */
  apiUrl: string;
}

/**
 * Identifiers required to connect to the Measure backend.
 * 
 * This class is used during SDK initialization via `Measure.initialize(...)`.
 * It provides the SDK with the credentials and endpoint needed to send analytics data.
 * 
 * @example
 * ```typescript
 * const clientInfo = new ClientInfo(
 *   apiKeyIos: "your-ios-api-key",
 *   apiKeyAndroid: "your-android-api-key",
 *   apiUrl: "https://localhost:8080"
 * );
 * ```
 */
class ClientInfo implements Client {
  apiKeyIos: string;
  apiKeyAndroid: string;
  apiUrl: string;

  /**
   * Creates a new ClientInfo instance.
   * 
   * @param apiKeyIos - The API key assigned to your iOS project
   * @param apiKeyAndroid - The API key assigned to your Android project
   * @param apiUrl - The backend URL where data will be sent (optional, defaults to api.measure.sh)
   * @throws Will log a debug message if apiKey is missing
   * @throws Will fall back to default API URL if provided URL is invalid
   */
  constructor(apiKeyIos: string, apiKeyAndroid: string, apiUrl: string) {
    if (!apiKeyIos || !apiKeyAndroid) {
      console.debug('Measure apiKey is missing, skipping initialization.');
    }

    try {
      // Validate URL
      new URL(apiUrl);
      this.apiUrl = apiUrl;
    } catch (e) {
      console.debug('Measure apiUrl is invalid, falling back to default.', apiUrl);
      this.apiUrl = FALLBACK_API_URL;
    }

    this.apiKeyIos = apiKeyIos;
    this.apiKeyAndroid = apiKeyAndroid;
  }
}

class ClientInfoInternal {
    apiKey: string;
    apiUrl: string;

    constructor(apiKey: string, apiUrl: string) {
      this.apiKey = apiKey;
      this.apiUrl = apiUrl;
    }
  }

export { ClientInfo, ClientInfoInternal };