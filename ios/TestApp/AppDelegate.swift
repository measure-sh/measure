//
//  AppDelegate.swift
//  TestApp
//
//  Created by Adwin Ross on 08/10/24.
//

import UIKit
@testable import Measure

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    let measureInstance = Measure.shared
    var mockMeasureInitializer: MockMeasureInitializer?
    let labelMessage: UILabel = {
        let lbl = UILabel()
        lbl.text = ""
        lbl.isAccessibilityElement = true
        lbl.accessibilityIdentifier = "log-output-label-message"
        lbl.textColor = .black
        lbl.font = UIFont.systemFont(ofSize: 18)
        lbl.textAlignment = .center
        lbl.translatesAutoresizingMaskIntoConstraints = false
        return lbl
    }()

    let labelData: UILabel = {
        let lbl = UILabel()
        lbl.text = ""
        lbl.isAccessibilityElement = true
        lbl.accessibilityIdentifier = "log-output-label-data"
        lbl.textColor = .black
        lbl.font = UIFont.systemFont(ofSize: 18)
        lbl.textAlignment = .center
        lbl.translatesAutoresizingMaskIntoConstraints = false
        return lbl
    }()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let clientInfo = ClientInfo(apiKey: "test", apiUrl: "test")
        let config = BaseMeasureConfig(enableLogging: true,
                                       samplingRateForErrorFreeSessions: 1.0)
        mockMeasureInitializer = MockMeasureInitializer()
        measureInstance.meaureInitializerInternal = mockMeasureInitializer
        measureInstance.initialize(with: clientInfo, config: config)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.addLogLabels()
        }

        return true
    }

    // MARK: UISceneSession Lifecycle

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
    }

    func addLogLabels() {
        if let logger = mockMeasureInitializer?.logger as? MockLogger {
            logger.onLog = { _, message, _, data in
                print("logger: ", logger.logs)
                if message.contains("gestureClick") ||
                   message.contains("gestureLongClick") ||
                   message.contains("gestureScroll") ||
                   message.contains("lifecycleViewController") ||
                   message.contains("coldLaunch") ||
                   message.contains("warmLaunch") ||
                   message.contains("hotLaunch") {
                    if let data = data {
                        if let jsonData = try? JSONEncoder().encode(data) {
                            print("jsonData: ", jsonData)
                            print("message: ", message)
                            self.labelData.text = String(data: jsonData, encoding: .utf8)
                        }
                    }
                    self.labelMessage.text = (self.labelMessage.text ?? "") + message + (self.labelData.text ?? "")
                }
            }
        }
        if let window = UIApplication.shared.windows.first {
            window.addSubview(labelMessage)
            NSLayoutConstraint.activate([
                labelMessage.centerXAnchor.constraint(equalTo: window.centerXAnchor),
                labelMessage.centerYAnchor.constraint(equalTo: window.centerYAnchor)
            ])
            window.addSubview(labelData)
            NSLayoutConstraint.activate([
                labelData.centerXAnchor.constraint(equalTo: window.centerXAnchor),
                labelData.topAnchor.constraint(equalTo: labelMessage.bottomAnchor, constant: 8)
            ])
        }
    }
}
