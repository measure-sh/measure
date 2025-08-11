/**
 * Default API URL for the Measure backend.
 */
const FALLBACK_API_URL = 'https://api.measure.sh';

/**
 * Interface defining the required client information.
 */
export interface Client {
  /** The API key assigned to your project. Available in the Measure dashboard. */
  apiKey: string;
  
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
 *   apiKey: "your-api-key",
 *   apiUrl: "https://localhost:8080"
 * );
 * ```
 */
export class ClientInfo implements Client {
  apiKey: string;
  apiUrl: string;

  /**
   * Creates a new ClientInfo instance.
   * 
   * @param apiKey - The API key assigned to your project
   * @param apiUrl - The backend URL where data will be sent (optional, defaults to api.measure.sh)
   * @throws Will log a debug message if apiKey is missing
   * @throws Will fall back to default API URL if provided URL is invalid
   */
  constructor(apiKey: string, apiUrl: string) {
    if (!apiKey) {
      console.debug('Measure apiKey is missing, skipping initialization.');
    }

    try {
      // Validate URL
      new URL(apiUrl);
      this.apiUrl = apiUrl;
    } catch (e) {
      console.debug('Measure apiUrl is invalid, falling back to default.');
      this.apiUrl = FALLBACK_API_URL;
    }

    this.apiKey = apiKey;
  }
}