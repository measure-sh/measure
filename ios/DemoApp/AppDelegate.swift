//
//  AppDelegate.swift
//  DemoApp
//
//  Created by Adwin Ross on 07/10/24.
//

import UIKit
import Measure

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        let clientInfo = ClientInfo(apiKey: "msrsh_38514d61493cf70ce99a11abcb461e9e6d823e2068c7124a0902b745598f7ffb_65ea2c1c",
                                    apiUrl: "http://localhost:8080")
        let config = BaseMeasureConfig(enableLogging: true,
                                       samplingRateForErrorFreeSessions: 1.0,
                                       traceSamplingRate: 1.0,
                                       autoStart: true,
                                       trackViewControllerLoadTime: true,
                                       screenshotMaskLevel: .sensitiveFieldsOnly)
        Measure.initialize(with: clientInfo, config: config)
        Measure.setUserId("test_user_ios")
        Measure.onShake {
            Measure.launchBugReport(takeScreenshot: true, bugReportConfig: BugReportConfig.default, attributes: nil)
        }

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
