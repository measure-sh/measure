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
}

/// `BaseMeasureInitializer` is responsible for setting up the internal configuration
///
/// Properties:
/// - `configProvider`: `ConfigProvider` object managing the `Config` for the MeasureSDK.
/// - `client`: `Client` object managing the `Config` for the MeasureSDK.
///
struct BaseMeasureInitializer: MeasureInitializer {
    let configProvider: ConfigProvider
    let client: Client

    init(config: MeasureConfig,
         client: Client) {
        let defaultConfig = Config(enableLogging: config.enableLogging,
                                   trackScreenshotOnCrash: config.trackScreenshotOnCrash,
                                   sessionSamplingRate: config.sessionSamplingRate)

        self.configProvider = BaseConfigProvider(defaultConfig: defaultConfig, configLoader: BaseConfigLoader())
        self.client = client
    }
}
