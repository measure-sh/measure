//
//  ConfigLoader.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/08/24.
//

import Foundation

/// A protocol that defines the methods for loading configuration data either a cache or a network source.
protocol ConfigLoader {
    var isConfigLoaded: Bool { get }
    func loadDynamicConfig(onLoaded: @escaping (DynamicConfig) -> Void)
}

/// A base implementation of the `ConfigLoader` protocol.
struct BaseConfigLoader: ConfigLoader {
    private final class ConfigState {
        var isConfigLoaded: Bool = false
    }

    private let state = ConfigState()
    var isConfigLoaded: Bool { state.isConfigLoaded }
    private let userDefaultStorage: UserDefaultStorage
    private let fileManager: SystemFileManager
    private let networkClient: NetworkClient
    private let timeProvider: TimeProvider
    private let decoder: JSONDecoder
    private let logger: Logger
    private let measureDispatchQueue: MeasureDispatchQueue
    private let dynamicConfig: BaseDynamicConfig

    init(userDefaultStorage: UserDefaultStorage,
         fileManager: SystemFileManager,
         networkClient: NetworkClient,
         timeProvider: TimeProvider,
         logger: Logger,
         measureDispatchQueue: MeasureDispatchQueue,
         dynamicConfig: BaseDynamicConfig = BaseDynamicConfig()) {
        self.dynamicConfig = dynamicConfig
        self.userDefaultStorage = userDefaultStorage
        self.fileManager = fileManager
        self.networkClient = networkClient
        self.timeProvider = timeProvider
        self.logger = logger
        self.measureDispatchQueue = measureDispatchQueue

        let decoder = JSONDecoder()
        decoder.userInfo[.fallbackDynamicConfig] = dynamicConfig
        self.decoder = decoder
    }

    func loadDynamicConfig(onLoaded: @escaping (DynamicConfig) -> Void) {
        let cachedConfig = loadConfigFromDisk()
        state.isConfigLoaded = true
        onLoaded(cachedConfig ?? dynamicConfig)
        refreshConfigFromServer()
    }

    private func loadConfigFromDisk() -> BaseDynamicConfig? {
        guard let data = fileManager.retrieveFile(
            name: ConfigFileConstants.fileName,
            folderName: "\(ConfigFileConstants.folderName)/\(ConfigFileConstants.dynamicConfigFolderName)",
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

    /// Saves the server response unchanged.
    private func saveConfigToDisk(_ data: Data) {
        _ = fileManager.saveFile(data: data,
                                 name: ConfigFileConstants.fileName,
                                 folderName: "\(ConfigFileConstants.folderName)/\(ConfigFileConstants.dynamicConfigFolderName)",
                                 directory: ConfigFileConstants.directory)
    }

    private func refreshConfigFromServer() { // swiftlint:disable:this function_body_length
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
            let remaining = cacheControl - (now - lastFetch)
            logger.internalLog(
                level: .debug,
                message: "ConfigLoader: CacheControl not expired, skipping refresh. now=\(now)ms, lastFetch=\(lastFetch)ms, cacheControl=\(cacheControl)ms, remaining=\(remaining)ms",
                error: nil,
                data: nil
            )
            return
        }

        measureDispatchQueue.submit {
            let response = networkClient.getConfig(eTag: userDefaultStorage.getConfigEtag())

            switch response {

            case .success(let data, let eTag, let cacheControl):

                do {
                    _ = try decoder.decode(BaseDynamicConfig.self, from: data)
                } catch {
                    logger.internalLog(level: .error, message: "ConfigLoader: Failed to decode config from server", error: error, data: nil)
                    return
                }
                saveConfigToDisk(data)

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

            case .notModified(let cacheControl):
                userDefaultStorage.setConfigFetchTimestamp(now)

                if cacheControl > 0 {
                    userDefaultStorage.setConfigCacheControl(cacheControl)
                }

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
}
