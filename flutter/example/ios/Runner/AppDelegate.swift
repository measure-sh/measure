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

    let clientInfo: ClientInfo

    #if DEBUG
    clientInfo = ClientInfo(
      apiKey: "msrsh_7c22875ec57832fa068f8f74e8a4663dd38688e462ca9bb5f70e2028ac0d5cd7_4461dc8e",
      apiUrl: "https://humbly-natural-polliwog.ngrok-free.app"
    )
    #else
    clientInfo = ClientInfo(
      apiKey: "msrsh_49154dbe42ba4649414c62059c72bd80fb7848fd74ad554d27d89edc5a107a5a_27ab5454",
      apiUrl: "https://humbly-natural-polliwog.ngrok-free.app"
    )
    #endif

    Measure.initialize(with: clientInfo, config: config)

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
