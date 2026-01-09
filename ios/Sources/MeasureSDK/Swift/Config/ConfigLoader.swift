//
//  ConfigLoader.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/08/24.
//

import Foundation

enum ConfigFileConstants {
    static let fileName = "dynamic_config.json"
    static let folderName = "measure"
    static let directory: FileManager.SearchPathDirectory = .cachesDirectory
}

/// A protocol that defines the methods for loading configuration data either a cache or a network source.
protocol ConfigLoader {
    func loadDynamicConfig(onLoaded: @escaping (DynamicConfig) -> Void)
}

/// A base implementation of the `ConfigLoader` protocol.
struct BaseConfigLoader: ConfigLoader {
    private let fileManager: SystemFileManager
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(fileManager: SystemFileManager) {
        self.fileManager = fileManager

        let decoder = JSONDecoder()
        self.decoder = decoder

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted]
        self.encoder = encoder
    }

    func loadDynamicConfig(onLoaded: @escaping (DynamicConfig) -> Void) {
        let cachedConfig = loadConfigFromDisk()
        onLoaded(cachedConfig ?? BaseDynamicConfig.default())
        refreshConfigFromServer()
    }

    private func loadConfigFromDisk() -> BaseDynamicConfig? {
        guard let data = fileManager.retrieveFile(
            name: ConfigFileConstants.fileName,
            folderName: ConfigFileConstants.folderName,
            directory: ConfigFileConstants.directory
        ) else {
            return nil
        }

        do {
            return try decoder.decode(BaseDynamicConfig.self, from: data)
        } catch {
            return nil
        }
    }

    private func saveConfigToDisk(_ config: BaseDynamicConfig) {
        do {
            let data = try encoder.encode(config)
            _ = fileManager.saveFile(
                data: data,
                name: ConfigFileConstants.fileName,
                folderName: ConfigFileConstants.folderName,
                directory: ConfigFileConstants.directory
            )
        } catch {
            // TODO: what to do is save fails
        }
    }

    private func refreshConfigFromServer() {
        DispatchQueue.global(qos: .background).async {
            guard let jsonData = self.dummyServerResponse() else {
                return
            }

            do {
                let config = try self.decoder.decode(BaseDynamicConfig.self, from: jsonData)
                self.saveConfigToDisk(config)
            } catch {
                // Ignore malformed response
            }
        }
    }

    private func dummyServerResponse() -> Data? {
        let json = """
        {
          "max_events_in_batch": 10000,
          "crash_timeline_duration": 300,
          "anr_timeline_duration": 300,
          "bug_report_timeline_duration": 300,
          "trace_sampling_rate": 0.01,
          "journey_sampling_rate": 0.01,
          "screenshot_mask_level": "all_text_and_media",
          "cpu_usage_interval": 5,
          "memory_usage_interval": 5,
          "crash_take_screenshot": true,
          "anr_take_screenshot": true,
          "launch_sampling_rate": 0.01,
          "gesture_click_take_snapshot": true,
          "http_disable_event_for_urls": [],
          "http_track_request_for_urls": [],
          "http_track_response_for_urls": [],
          "http_blocked_headers": []
        }
        """
        return json.data(using: .utf8)
    }
}
