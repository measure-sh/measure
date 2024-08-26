//
//  MeasureInitializer.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/08/24.
//

import Foundation

protocol MeasureInitializerProtocol {
    var configProvider: ConfigProviderProtocol { get }
}

struct MeasureInitializer: MeasureInitializerProtocol {
    let configProvider: ConfigProviderProtocol

    init(_ config: MeasureConfigProtocol) {
        let defaultConfig = Config(enableLogging: config.enableLogging,
                                   trackScreenshotOnCrash: config.trackScreenshotOnCrash,
                                   sessionSamplingRate: config.sessionSamplingRate)

        configProvider = ConfigProvider(defaultConfig: defaultConfig, configLoader: ConfigLoader())
    }
}
