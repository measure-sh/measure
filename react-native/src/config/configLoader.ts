import { Config } from "./config";

// A protocol that defines the methods for loading configuration data either from a cache or a network source.
export interface ConfigLoader {
  getCachedConfig(): Config | null;
  getNetworkConfig(onSuccess: (config: Config) => void): void;
}

// A base implementation of the `ConfigLoader` interface.
export class BaseConfigLoader implements ConfigLoader {
  // Returns the cached configuration if available.
  // TODO: Load the cached config from disk.
  getCachedConfig(): Config | null {
    return null;
  }

  // Fetches a fresh configuration from the server.
  // TODO: Fetch the config from the server, write it to disk, and call onSuccess.
  getNetworkConfig(onSuccess: (config: Config) => void): void {
    // Simulate async fetch
    setTimeout(() => {
      const config = new Config(); // Replace with actual fetched config later
      onSuccess(config);
    }, 1000);
  }
}