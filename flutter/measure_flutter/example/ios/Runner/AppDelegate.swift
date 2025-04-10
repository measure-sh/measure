import Flutter
import UIKit
import Measure

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    let config = BaseMeasureConfig(enableLogging: true)
    let clientInfo = ClientInfo(apiKey: "<apiKey>", apiUrl: "<apiUrl>")
    Measure.shared.initialize(with: clientInfo, config: config)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
