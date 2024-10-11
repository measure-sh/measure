//
//  ViewController.swift
//  TestApp
//
//  Created by Adwin Ross on 08/10/24.
//

import UIKit

final class ViewController: UIViewController, UITableViewDelegate, UITableViewDataSource {
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
    let labelMessage: UILabel = {
        let lbl = UILabel()
        lbl.text = ""
        lbl.isAccessibilityElement = true
        lbl.accessibilityIdentifier = "log-output-label-message"
        lbl.textColor = .black
        lbl.font = UIFont.systemFont(ofSize: 18)
        lbl.textAlignment = .center
        lbl.translatesAutoresizingMaskIntoConstraints = false
        return lbl
    }()

    let labelData: UILabel = {
        let lbl = UILabel()
        lbl.text = ""
        lbl.isAccessibilityElement = true
        lbl.accessibilityIdentifier = "log-output-label-data"
        lbl.textColor = .black
        lbl.font = UIFont.systemFont(ofSize: 18)
        lbl.textAlignment = .center
        lbl.translatesAutoresizingMaskIntoConstraints = false
        return lbl
    }()

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
        if let appDelegate = UIApplication.shared.delegate as? AppDelegate, let logger = appDelegate.mockMeasureInitializer?.logger as? MockLogger {
            logger.onLog = { _, message, _, data in
                self.labelMessage.text = message
                if let data = data {
                    if let jsonData = try? JSONEncoder().encode(data) {
                        self.labelData.text = String(data: jsonData, encoding: .utf8)
                    }
                }
            }
        }
        view.addSubview(labelMessage)
        NSLayoutConstraint.activate([
            labelMessage.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            labelMessage.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        view.addSubview(labelData)
        NSLayoutConstraint.activate([
            labelData.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            labelData.topAnchor.constraint(equalTo: labelMessage.bottomAnchor, constant: 8)
        ])
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

    @objc func headerButtonTapped(_ sender: UIButton) {}

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
