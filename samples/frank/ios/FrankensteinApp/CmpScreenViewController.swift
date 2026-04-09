import UIKit
import Shared

class CmpScreenViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let cmpVC = MainViewControllerKt.CmpViewController()
        addChild(cmpVC)
        cmpVC.view.frame = view.bounds
        cmpVC.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(cmpVC.view)
        cmpVC.didMove(toParent: self)
    }
}
