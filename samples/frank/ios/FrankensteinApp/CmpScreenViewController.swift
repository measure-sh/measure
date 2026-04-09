import UIKit
import Shared

class CmpScreenViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let cmpVC = MainViewControllerKt.CmpViewController()
        addChild(cmpVC)
        cmpVC.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cmpVC.view)
        NSLayoutConstraint.activate([
            cmpVC.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            cmpVC.view.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            cmpVC.view.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            cmpVC.view.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor)
        ])
        cmpVC.didMove(toParent: self)
    }
}
