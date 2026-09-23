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
        let clientInfo = ClientInfo(apiKey: "msrsh_0aa61e53f87da536285373a47193b3a2baecd5fa35785146f77ce4e1601b739d_98a55756",
                                    apiUrl: "http://localhost:8080")
        final class CustomHeaderProvider: NSObject, MsrRequestHeadersProvider {
            private var requestHeaders: NSDictionary = ["key1": "value1", "key2": "value2"]

            func getRequestHeaders() -> NSDictionary {
                return requestHeaders
            }
        }
        let measureConfig = BaseMeasureConfig(enableLogging: true,
                                              autoStart: true,
                                              requestHeadersProvider: CustomHeaderProvider(),
                                              maxDiskUsageInMb: 100,
                                              enableFullCollectionMode: true,
                                              enableDiagnosticMode: true,
                                              enableDiagnosticModeGesture: true)
        Measure.initialize(with: clientInfo, config: measureConfig)
        Measure.setUserId("test_user_ios")
        Measure.onShake {
            Measure.launchBugReport(takeScreenshot: true, bugReportConfig: BugReportConfig.default, attributes: nil)
        }

        scheduleLaunchHangIfRequested()

        return true
    }

    /// Blocks the main thread shortly after launch when `MSR_DEMO_HANG_SECONDS` is set, so app hang
    /// detection can be exercised without driving the UI. The simulator cannot be tapped from the
    /// command line, which makes this the only way to verify a hang end to end from a script.
    private func scheduleLaunchHangIfRequested() {
        guard let value = ProcessInfo.processInfo.environment["MSR_DEMO_HANG_SECONDS"],
              let seconds = TimeInterval(value), seconds > 0 else {
            return
        }

        // Deferred so the SDK has finished starting and the detector is already polling.
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            Thread.sleep(forTimeInterval: seconds)
        }
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
