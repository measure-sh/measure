import SwiftUI
import Measure
import Firebase
import Shared

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let config = BaseMeasureConfig(
            enableLogging: true,
            enableFullCollectionMode: true
        )
        FirebaseApp.configure()
        let clientInfo = ClientInfo(apiKey: "msrsh_13d5a67bac58183f532c31e32a86abd2e25b5d683da4a523183bf935f79ed840_d03d5eb3", apiUrl: "https://staging-ingest.measure.sh")
        Measure.initialize(with: clientInfo, config: config)
        MeasureUnhandledExceptionHookKt.setMeasureUnhandledExceptionHook()

        return true
    }
}

@main
struct MeasureApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
