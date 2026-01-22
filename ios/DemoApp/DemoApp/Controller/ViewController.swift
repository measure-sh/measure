//
//  ViewController.swift
//  MeasureDemo
//
//  Created by Adwin Ross on 12/08/24.
//

import UIKit
import SwiftUI
import Measure

@objc final class ViewController: MsrViewController, UITableViewDelegate, UITableViewDataSource {
    enum TableSection: Int, CaseIterable {
        case crashes = 0
        case httpEvents = 1

        var title: String {
            switch self {
            case .crashes:
                return "Crash Types"
            case .httpEvents:
                return "HTTP Events"
            }
        }
    }

    let crashTypes = ["Abort",
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
                      "Bus Error (SIGBUS)"]

    let httpEventTypes = ["GET – 200 OK (JSON)",
                          "POST – 201 Created (JSON body)",
                          "PUT – 400 Client Error",
                          "GET – Network Error",
                          "GET – Non-JSON Response"]

    private let tableView = UITableView(frame: .zero, style: .plain)

    override func viewDidLoad() {
        super.viewDidLoad()

        title = "Swift View Controller"
        tableView.accessibilityIdentifier = "HomeTableView"
        tableView.delegate = self
        tableView.dataSource = self
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")

        tableView.tableHeaderView = createTableHeaderView()
        view.addSubview(tableView)

        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        do {
            let path = "/path/that/does/not/exist.txt"
            _ = try String(contentsOfFile: path, encoding: .utf8)
        } catch {
            Measure.trackError(error, collectStackTraces: true)
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        let attributes: [String: AttributeValue] = ["user_name": .string("Alice"),
                                                    "paid_user": .boolean(true),
                                                    "credit_balance": .int(1000),
                                                    "latitude": .double(30.2661403415387)]

        Measure.trackScreenView("Home", attributes: attributes)
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)

        let attributes: [String: AttributeValue] = ["user_name": .string("Alice"),
                                                    "paid_user": .boolean(true),
                                                    "credit_balance": .int(1000),
                                                    "latitude": .double(30.2661403415387)]
        Measure.trackEvent(name: "custom_event", attributes: attributes, timestamp: nil)
    }

    func createTableHeaderView() -> UIView {
        let headerView = UIView()

        let buttonTitles = [
            "SwiftUI Controller",
            "Objc Controller",
            "Collection Controller",
            "System Controls",
            "Bug Reporter"
        ]

        let column1 = UIStackView()
        column1.axis = .vertical
        column1.spacing = 8
        column1.distribution = .fillEqually

        let column2 = UIStackView()
        column2.axis = .vertical
        column2.spacing = 8
        column2.distribution = .fillEqually

        for (index, title) in buttonTitles.enumerated() {
            let button = UIButton(type: .system)
            button.setTitle(title, for: .normal)
            button.tag = index
            button.layer.cornerRadius = 8
            button.layer.borderWidth = 1
            button.layer.borderColor = UIColor.systemBlue.cgColor
            button.heightAnchor.constraint(equalToConstant: 44).isActive = true
            button.addTarget(self, action: #selector(headerButtonTapped(_:)), for: .touchUpInside)

            (index % 2 == 0 ? column1 : column2).addArrangedSubview(button)
        }

        let horizontalStack = UIStackView(arrangedSubviews: [column1, column2])
        horizontalStack.axis = .horizontal
        horizontalStack.spacing = 16
        horizontalStack.translatesAutoresizingMaskIntoConstraints = false

        headerView.addSubview(horizontalStack)

        NSLayoutConstraint.activate([
            horizontalStack.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 16),
            horizontalStack.trailingAnchor.constraint(equalTo: headerView.trailingAnchor, constant: -16),
            horizontalStack.topAnchor.constraint(equalTo: headerView.topAnchor, constant: 8),
            horizontalStack.bottomAnchor.constraint(equalTo: headerView.bottomAnchor, constant: -8)
        ])

        headerView.frame = CGRect(
            x: 0,
            y: 0,
            width: UIScreen.main.bounds.width,
            height: 150
        )

        return headerView
    }

    @objc func headerButtonTapped(_ sender: UIButton) {
        switch sender.tag {
        case 0:
            let swiftUIView = SwiftUIDetailViewController()
            let hostingController = UIHostingController(rootView: swiftUIView)
            navigationController?.pushViewController(hostingController, animated: true)

        case 1:
            let controller = ObjcDetailViewController()
            navigationController?.pushViewController(controller, animated: true)

        case 2:
            let controller = CollectionViewController()
            navigationController?.pushViewController(controller, animated: true)

        case 3:
            if let controller = storyboard?.instantiateViewController(
                withIdentifier: "ControlsViewController"
            ) {
                navigationController?.pushViewController(controller, animated: true)
            }

        case 4:
            let colors = BugReportConfig.default.colors
                .update(badgeColor: .red, isDarkMode: true)

            let dimensions = MsrDimensions(topPadding: 20)
            let config = BugReportConfig(colors: colors, dimensions: dimensions)

            Measure.launchBugReport(takeScreenshot: true, bugReportConfig: config)

        default:
            break
        }
    }

    func numberOfSections(in tableView: UITableView) -> Int {
        TableSection.allCases.count
    }

    func tableView(_ tableView: UITableView,
                   titleForHeaderInSection section: Int) -> String? {
        TableSection(rawValue: section)?.title
    }

    func tableView(_ tableView: UITableView,
                   numberOfRowsInSection section: Int) -> Int {
        guard let sectionType = TableSection(rawValue: section) else { return 0 }
        return sectionType == .crashes ? crashTypes.count : httpEventTypes.count
    }

    func tableView(_ tableView: UITableView,
                   cellForRowAt indexPath: IndexPath) -> UITableViewCell {

        let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
        guard let sectionType = TableSection(rawValue: indexPath.section) else { return cell }

        switch sectionType {
        case .crashes:
            cell.textLabel?.text = crashTypes[indexPath.row]
            cell.textLabel?.textColor = .systemRed

        case .httpEvents:
            cell.textLabel?.text = httpEventTypes[indexPath.row]
            cell.textLabel?.textColor = .systemBlue
        }

        return cell
    }

    // MARK: - UITableViewDelegate

    func tableView(_ tableView: UITableView,
                   didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)

        guard let sectionType = TableSection(rawValue: indexPath.section) else { return }

        switch sectionType {
        case .crashes:
            triggerCrash(type: crashTypes[indexPath.row])
        case .httpEvents:
            triggerHttpEvent(type: httpEventTypes[indexPath.row])
        }
    }

    // MARK: - HTTP Tracking

    func triggerHttpEvent(type: String) {
        let startTime = UInt64(CFAbsoluteTimeGetCurrent() * 1000)
        let endTime = startTime + 150

        switch type {

        case "GET – 200 OK (JSON)":
            Measure.trackHttpEvent(
                url: "https://api.com/users",
                method: "get",
                startTime: startTime,
                endTime: endTime,
                client: "URLSession",
                statusCode: 200,
                responseHeaders: ["Content-Type": "application/json"],
                responseBody: #"{"id":1,"name":"Alice"}"#
            )

        case "POST – 201 Created (JSON body)":
            Measure.trackHttpEvent(
                url: "https://api.example.com/users",
                method: "post",
                startTime: startTime,
                endTime: endTime,
                client: "URLSession",
                statusCode: 201,
                requestHeaders: ["Content-Type": "application/json", "custom-header": "should-not-be-tracked"],
                responseHeaders: ["Content-Type": "application/json", "custom-header": "should-not-be-tracked"],
                requestBody: #"{"name":"Alice"}"#,
                responseBody: #"{"id":42}"#
            )

        case "PUT – 400 Client Error":
            Measure.trackHttpEvent(
                url: "https://api.example.com/users/42",
                method: "put",
                startTime: startTime,
                endTime: endTime,
                client: "URLSession",
                statusCode: 400,
                responseHeaders: ["Content-Type": "application/json"],
                responseBody: #"{"error":"Invalid request"}"#
            )

        case "GET – Network Error":
            Measure.trackHttpEvent(
                url: "https://api.example.com/timeout",
                method: "get",
                startTime: startTime,
                endTime: endTime,
                client: "URLSession",
                error: URLError(.timedOut)
            )

        case "GET – Non-JSON Response":
            Measure.trackHttpEvent(
                url: "https://example.com/html",
                method: "get",
                startTime: startTime,
                endTime: endTime,
                client: "URLSession",
                statusCode: 200,
                responseHeaders: ["Content-Type": "text/html"],
                responseBody: "<html>ignored</html>"
            )

        default:
            break
        }
    }

    // MARK: - Crash Triggers (unchanged)

    func triggerCrash(type: String) {
        switch type {
        case "Abort": abort()
        case "Bad Pointer":
            let pointer = UnsafeMutableRawPointer(bitPattern: 0xdeadbeef)!
            pointer.storeBytes(of: 0, as: Int.self)
        case "Corrupt Memory":
            let array = [1, 2, 3]
            _ = array[10]
        case "Corrupt Object":
            let object: AnyObject = NSArray()
            _ = object.perform(Selector(("invalidSelector")))
        case "Deadlock":
            let queue = DispatchQueue(label: "deadlockQueue")
            queue.sync { queue.sync {} }
        case "NSException":
            let array = NSArray()
            print(array[1])
        case "Stack Overflow":
            func recurse() { recurse() }
            recurse()
        default:
            fatalError("Triggered crash: \(type)")
        }
    }
}
