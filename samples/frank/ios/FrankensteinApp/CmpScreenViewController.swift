import UIKit
import Shared

class CmpScreenViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let cmpVC = MainViewControllerKt.CmpViewController(onClose: { [weak self] in
            self?.navigationController?.popViewController(animated: true)
        })
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

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.setNavigationBarHidden(true, animated: animated)
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        navigationController?.setNavigationBarHidden(false, animated: animated)
    }
}
