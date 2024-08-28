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
}

/// `BaseMeasureInitializer` is responsible for setting up the internal configuration
///
/// Properties:
/// - `configProvider`: `ConfigProvider` object managing the `Config` for the MeasureSDK.
/// 
struct BaseMeasureInitializer: MeasureInitializer {
    let configProvider: ConfigProvider

    init(_ config: MeasureConfig) {
        let defaultConfig = Config(enableLogging: config.enableLogging,
                                   trackScreenshotOnCrash: config.trackScreenshotOnCrash,
                                   sessionSamplingRate: config.sessionSamplingRate)

        configProvider = BaseConfigProvider(defaultConfig: defaultConfig, configLoader: BaseConfigLoader())
    }
}
