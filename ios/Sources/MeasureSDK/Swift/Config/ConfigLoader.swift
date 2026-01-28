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
    private let userDefaultStorage: UserDefaultStorage
    private let fileManager: SystemFileManager
    private let networkClient: NetworkClient
    private let timeProvider: TimeProvider
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private let logger: Logger

    init(userDefaultStorage: UserDefaultStorage,
         fileManager: SystemFileManager,
         networkClient: NetworkClient,
         timeProvider: TimeProvider,
         logger: Logger) {
        self.userDefaultStorage = userDefaultStorage
        self.fileManager = fileManager
        self.networkClient = networkClient
        self.timeProvider = timeProvider
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
        let now = timeProvider.now()

        let lastFetch = userDefaultStorage.getConfigFetchTimestamp()
        let cacheControl = userDefaultStorage.getConfigCacheControl()

        let shouldRefresh: Bool

        if lastFetch == 0 || cacheControl == 0 {
            shouldRefresh = true
        } else {
            shouldRefresh = now - lastFetch > cacheControl
        }

        if !shouldRefresh {
            logger.internalLog(
                level: .debug,
                message: "ConfigLoader: CacheControl not expired, skipping refresh",
                error: nil,
                data: nil
            )
            return
        }

        let response = networkClient.getConfig(eTag: userDefaultStorage.getConfigEtag())

        switch response {

        case .success(let config, let eTag, let cacheControl):

            saveConfigToDisk(config)

            userDefaultStorage.setConfigFetchTimestamp(now)
            userDefaultStorage.setConfigCacheControl(Number(cacheControl))

            if let eTag {
                userDefaultStorage.setConfigEtag(eTag)
            }

            logger.internalLog(
                level: .debug,
                message: "ConfigLoader: New config loaded from server successfully",
                error: nil,
                data: nil
            )

        case .notModified:

            userDefaultStorage.setConfigFetchTimestamp(now)

            logger.internalLog(
                level: .debug,
                message: "ConfigLoader: 304 Not Modified",
                error: nil,
                data: nil
            )

        case .error:

            logger.internalLog(
                level: .error,
                message: "ConfigLoader: Failed to load config from server",
                error: nil,
                data: nil
            )
        }
    }
}
