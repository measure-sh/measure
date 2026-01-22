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
    private let networkClient: NetworkClient
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private let logger: Logger

    init(fileManager: SystemFileManager, networkClient: NetworkClient, logger: Logger) {
        self.fileManager = fileManager
        self.networkClient = networkClient
        self.logger = logger

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
            _ = fileManager.saveFile(data: data,
                                     name: ConfigFileConstants.fileName,
                                     folderName: ConfigFileConstants.folderName,
                                     directory: ConfigFileConstants.directory)
        } catch {
            logger.internalLog(level: .error, message: "Failed to save Dynamic config to disk.", error: error, data: nil)
        }
    }

    private func refreshConfigFromServer() {
        guard let config = networkClient.getConfig(eTag: nil), let dynamicConfig = config as? BaseDynamicConfig else {
            return
        }

        self.saveConfigToDisk(dynamicConfig)
    }
}
