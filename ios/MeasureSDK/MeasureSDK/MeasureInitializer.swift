//
//  MeasureInitializer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/08/24.
//

import Foundation

protocol MeasureInitializer {
    var configProvider: ConfigProvider { get }
}

struct BaseMeasureInitializer: MeasureInitializer {
    let configProvider: ConfigProvider

    init(_ config: MeasureConfig) {
        let defaultConfig = Config(enableLogging: config.enableLogging,
                                   trackScreenshotOnCrash: config.trackScreenshotOnCrash,
                                   sessionSamplingRate: config.sessionSamplingRate)

        configProvider = BaseConfigProvider(defaultConfig: defaultConfig, configLoader: ConfigLoader())
    }
}
