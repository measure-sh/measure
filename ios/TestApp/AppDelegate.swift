//
//  AppDelegate.swift
//  TestApp
//
//  Created by Adwin Ross on 08/10/24.
//

import UIKit
@testable import MeasureSDK

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    let measureInstance = Measure.shared
    var mockMeasureInitializer: MockMeasureInitializer?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let clientInfo = ClientInfo(apiKey: "test", apiUrl: "test")
        let config = BaseMeasureConfig(enableLogging: true,
                                       trackScreenshotOnCrash: false,
                                       sessionSamplingRate: 1.0)
        mockMeasureInitializer = MockMeasureInitializer(config: config, client: clientInfo)
        measureInstance.meaureInitializerInternal = mockMeasureInitializer
        measureInstance.initialize(with: clientInfo, config: config)

        return true
    }

    // MARK: UISceneSession Lifecycle

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
    }
}
