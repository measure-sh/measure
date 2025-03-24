//
//  ViewController.swift
//  TestApp
//
//  Created by Adwin Ross on 08/10/24.
//

import UIKit
import Measure

final class ViewController: MeasureViewController, UITableViewDelegate, UITableViewDataSource {
    let crashTypes = [
        "Abort",
        "Bad Pointer",
        "Corrupt Memory",
        "Corrupt Object",
        "Deadlock",
        "NSException",
        "Stack Overflow",
        "Zombie",
        "Zombie NSException",
        "Background thread crash",
        "Segmentation Fault (SIGSEGV)",
        "Abnormal Termination (SIGABRT)",
        "Illegal Instruction (SIGILL)",
        "Bus Error (SIGBUS)"
    ]

    override func viewDidLoad() {
        super.viewDidLoad()

        self.title = "Swift View Controller"
        let tableView = UITableView(frame: view.bounds, style: .plain)
        tableView.accessibilityIdentifier = "HomeTableView"
        tableView.delegate = self
        tableView.dataSource = self

        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")

        let headerView = createTableHeaderView()
        tableView.tableHeaderView = headerView

        view.addSubview(tableView)
    }

    // MARK: - Table Header View with Buttons

    func createTableHeaderView() -> UIView {
        let headerView = UIView(frame: CGRect(x: 0, y: 0, width: view.bounds.width, height: 150))

        let buttonTitles = ["SwiftUI Controller", "Swift Controller", "Objc Controller", "Collection Controller", "System Controls"]

        // Create vertical stack views to hold two buttons each
        let verticalStackView1 = UIStackView()
        verticalStackView1.axis = .vertical
        verticalStackView1.distribution = .fillEqually
        verticalStackView1.spacing = 8

        let verticalStackView2 = UIStackView()
        verticalStackView2.axis = .vertical
        verticalStackView2.distribution = .fillEqually
        verticalStackView2.spacing = 8

        for (index, title) in buttonTitles.enumerated() {
            let button = UIButton(type: .system)
            button.layer.cornerRadius = 8
            button.layer.borderWidth = 1
            button.layer.borderColor = UIColor.systemBlue.cgColor
            button.setTitle(title, for: .normal)
            button.tag = index
            button.addTarget(self, action: #selector(headerButtonTapped(_:)), for: .touchUpInside)

            if index < 2 {
                verticalStackView1.addArrangedSubview(button)
            } else {
                verticalStackView2.addArrangedSubview(button)
            }
        }

        let horizontalStackView = UIStackView(arrangedSubviews: [verticalStackView1, verticalStackView2])
        horizontalStackView.axis = .horizontal
        horizontalStackView.distribution = .fillEqually
        horizontalStackView.spacing = 16

        horizontalStackView.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(horizontalStackView)

        NSLayoutConstraint.activate([
            horizontalStackView.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 20),
            horizontalStackView.trailingAnchor.constraint(equalTo: headerView.trailingAnchor, constant: -20),
            horizontalStackView.topAnchor.constraint(equalTo: headerView.topAnchor, constant: 8),
            horizontalStackView.bottomAnchor.constraint(equalTo: headerView.bottomAnchor, constant: -8)
        ])

        return headerView
    }

    @objc func headerButtonTapped(_ sender: UIButton) {
        if sender.tag != 0 {
            let controller = ViewController()
            self.navigationController?.pushViewController(controller, animated: true)
        }
    }

    // MARK: - UITableViewDataSource

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return crashTypes.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
        cell.textLabel?.text = crashTypes[indexPath.row]
        return cell
    }

    // MARK: - UITableViewDelegate

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let selectedCrashType = crashTypes[indexPath.row]
        triggerCrash(type: selectedCrashType)
    }

    // MARK: - Crash Triggers

    func triggerCrash(type: String) {
        print("Crash triggered: \(type)")
    }
}
