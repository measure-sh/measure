import UIKit
import Flutter
import FlutterPluginRegistrant

class FlutterScreenViewController: UIViewController {
    private var flutterEngine: FlutterEngine!

    override func viewDidLoad() {
        super.viewDidLoad()

        flutterEngine = FlutterEngine(name: "frankenstein_flutter")
        flutterEngine.run()
        GeneratedPluginRegistrant.register(with: flutterEngine)

        let flutterVC = FlutterViewController(engine: flutterEngine, nibName: nil, bundle: nil)
        addChild(flutterVC)
        flutterVC.view.frame = view.bounds
        flutterVC.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(flutterVC.view)
        flutterVC.didMove(toParent: self)
    }
}
