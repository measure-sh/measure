import UIKit
import FirebaseCore
import Measure

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        let apiKey = Bundle.main.object(forInfoDictionaryKey: "MeasureApiKey") as? String ?? ""
        let apiUrl = Bundle.main.object(forInfoDictionaryKey: "MeasureApiUrl") as? String ?? ""
        let clientInfo = ClientInfo(apiKey: apiKey, apiUrl: apiUrl)
        let config = BaseMeasureConfig(
            enableLogging: true,
            enableFullCollectionMode: true,
            enableDiagnosticMode: true,
            enableDiagnosticModeGesture: true
        )
        Measure.initialize(with: clientInfo, config: config)

        FirebaseApp.configure()

        let measureGreen = UIColor(red: 0x2E/255.0, green: 0x7D/255.0, blue: 0x32/255.0, alpha: 1.0)
        UINavigationBar.appearance().tintColor = measureGreen

        window = UIWindow(frame: UIScreen.main.bounds)
        let nav = UINavigationController(rootViewController: HomeViewController())
        window?.rootViewController = nav
        window?.makeKeyAndVisible()
        return true
    }
}
