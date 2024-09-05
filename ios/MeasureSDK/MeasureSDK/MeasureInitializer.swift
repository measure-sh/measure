//
//  MeasureInitializer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/08/24.
//

import Foundation

/// Protocol defining the requirements for initializing the Measure SDK.
protocol MeasureInitializer {
    var configProvider: ConfigProvider { get }
    var client: Client { get }
    var logger: Logger { get }
    var sessionManager: SessionManager { get }
    var idProvider: IdProvider { get }
    var timeProvider: TimeProvider { get }
}

/// `BaseMeasureInitializer` is responsible for setting up the internal configuration
///
/// Properties:
/// - `configProvider`: `ConfigProvider` object managing the `Config` for the MeasureSDK.
/// - `client`: `Client` object managing the `Config` for the MeasureSDK.
/// - `logger`: `Logger` object used for logging messages and errors within the MeasureSDK.
/// - `sessionManager`: `SessionManager` for the MeasureSDK.
/// - `idProvider`: `IdProvider` object used to generate unique identifiers.
/// - `timeProvider`: `TimeProvider` object providing time-related information.
///
final class BaseMeasureInitializer: MeasureInitializer {
    let configProvider: ConfigProvider
    let client: Client
    let logger: Logger
    let sessionManager: SessionManager
    let idProvider: IdProvider
    let timeProvider: TimeProvider

    init(config: MeasureConfig,
         client: Client) {
        let defaultConfig = Config(enableLogging: config.enableLogging,
                                   trackScreenshotOnCrash: config.trackScreenshotOnCrash,
                                   sessionSamplingRate: config.sessionSamplingRate)

        self.configProvider = BaseConfigProvider(defaultConfig: defaultConfig,
                                                 configLoader: BaseConfigLoader())
        self.timeProvider = SystemTimeProvider(systemTime: BaseSystemTime())
        self.logger = MeasureLogger(enabled: configProvider.enableLogging)
        self.idProvider = UUIDProvider()
        self.sessionManager = BaseSessionManager(idProvider: idProvider,
                                                    logger: logger,
                                                    timeProvider: timeProvider,
                                                    configProvider: configProvider)
        self.client = client
    }
}
