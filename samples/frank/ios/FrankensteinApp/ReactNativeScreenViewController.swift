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
        RCTBundleURLProvider.sharedSettings()
            .jsBundleURL(forBundleRoot: "index", fallbackExtension: "jsbundle")
    }
}
