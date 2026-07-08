import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

class ReactNativeScreenViewController: UIViewController {
    private var reactNativeFactory: RCTReactNativeFactory?
    private var reactNativeDelegate: ReactNativeDelegate?

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "React Native Demos"

        reactNativeDelegate = ReactNativeDelegate()
        reactNativeDelegate!.dependencyProvider = RCTAppDependencyProvider()
        reactNativeFactory = RCTReactNativeFactory(delegate: reactNativeDelegate!)

        let rnView = reactNativeFactory!.rootViewFactory.view(withModuleName: "FrankensteinRN")
        rnView.frame = view.bounds
        rnView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(rnView)
    }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
    override func bundleURL() -> URL? {
        // Use Metro only when a developer is actually running it. Otherwise
        // (e2e, standalone launches) load the packaged production bundle
        // directly. Going through RCTBundleURLProvider in a Debug build keeps
        // native dev support on, so the "Connect to Metro" banner and redbox
        // appear; the banner shifts the UI and breaks automation taps.
        if isMetroRunning() {
            return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
        }
        return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    }

    private func isMetroRunning() -> Bool {
        guard let url = URL(string: "http://localhost:8081/status") else { return false }
        var request = URLRequest(url: url)
        request.timeoutInterval = 1
        let semaphore = DispatchSemaphore(value: 0)
        var running = false
        let task = URLSession.shared.dataTask(with: request) { data, _, _ in
            if let data, let body = String(data: data, encoding: .utf8) {
                running = body.contains("packager-status:running")
            }
            semaphore.signal()
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 1.5)
        return running
    }
}
