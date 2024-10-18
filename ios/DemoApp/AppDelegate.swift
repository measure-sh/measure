//
//  AppDelegate.swift
//  DemoApp
//
//  Created by Adwin Ross on 07/10/24.
//

import UIKit
import MeasureSDK

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var measureInstance = Measure.shared
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        let clientInfo = ClientInfo(apiKey: "msrsh_48153449fa6045685d605a6dcb684cbf42d5b1cdf780cd79bd58a4423ce8b23d_e6b33343",
                                    apiUrl: "http://localhost:8080")
        let config = BaseMeasureConfig(enableLogging: true,
                                       trackScreenshotOnCrash: false,
                                       sessionSamplingRate: 1.0)
        measureInstance.initialize(with: clientInfo, config: config)

        return true
    }

    // MARK: UISceneSession Lifecycle

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        // Called when a new scene session is being created.
        // Use this method to select a configuration to create the new scene with.
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
        // Called when the user discards a scene session.
        // If any sessions were discarded while the application was not running, this will be called shortly after application:didFinishLaunchingWithOptions.
        // Use this method to release any resources that were specific to the discarded scenes, as they will not return.
    }
}
