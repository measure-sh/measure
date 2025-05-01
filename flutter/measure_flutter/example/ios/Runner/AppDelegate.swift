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
    let config = BaseMeasureConfig(
        enableLogging: true,
        samplingRateForErrorFreeSessions: 1.0
    )
    let clientInfo = ClientInfo(apiKey: "msrsh_49154dbe42ba4649414c62059c72bd80fb7848fd74ad554d27d89edc5a107a5a_27ab5454", apiUrl: "https://3719-49-207-224-123.ngrok-free.app")
    Measure.shared.initialize(with: clientInfo, config: config)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
