//
//  ViewController.swift
//  MeasureDemo
//
//  Created by Adwin Ross on 12/08/24.
//

import UIKit
import SwiftUI
import ObjectiveC
import Measure

@objc final class ViewController: MsrViewController, UITableViewDelegate, UITableViewDataSource {
    enum TableSection: Int, CaseIterable {
        case crashes = 0
        case httpEvents = 1
        case validationFailures = 2
        case appHangs = 3

        var title: String {
            switch self {
            case .crashes:
                return "Crash Types"
            case .httpEvents:
                return "HTTP Events"
            case .validationFailures:
                return "Validation Failures"
            case .appHangs:
                return "App Hangs"
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
                      "Bus Error (SIGBUS)",
                      "Track Handled NSException",
                      "Track Handled NSError",
                      "Track Swift Error (main thread)",
                      "Track NSException (main thread)",
                      "ObjC Runtime Lock Deadlock"]

    let httpEventTypes = ["GET – 200 OK (JSON)",
                          "POST – 201 Created (JSON body)",
                          "PUT – 400 Client Error",
                          "GET – Network Error",
                          "GET – Non-JSON Response"]

    let validationFailureTypes = ["Long user ID (129)",
                                  "Clear user ID",
                                  "Attribute key with dot",
                                  "Attribute key empty",
                                  "Span attribute key invalid",
                                  "Span empty name",
                                  "Long screen view name (1025)",
                                  "Long HTTP client (33)",
                                  "Long bug report description (4001)",
                                  "Bug report with 6 attachments",
                                  "Bug report attribute key invalid",
                                  "Attachment with empty name",
                                  "Huge NSError userInfo (exception.meta)",
                                  "Custom event timestamp before session",
                                  "Long thread name (129)",
                                  "Gesture target / target_id screen",
                                  "Long VC class name (>256)",
                                  "Long SwiftUI view name (129)",
                                  "Long launched_activity (present, then background/foreground)"]

    let appHangTypes = ["Block Main Thread", "Block Allocator Lock"]

    private let tableView = UITableView(frame: .zero, style: .plain)
    private var didRunLaunchValidationTrigger = false

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

    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Measure.logError("Home Error")

        let attributes: [String: AttributeValue] = ["user_name": .string("Alice"),
                                                    "paid_user": .boolean(true),
                                                    "credit_balance": .int(1000),
                                                    "latitude": .double(30.2661403415387)]

        Measure.trackScreenView("Home", attributes: attributes)

        if !didRunLaunchValidationTrigger,
           let trigger = UserDefaults.standard.string(forKey: "validationTrigger") {
            didRunLaunchValidationTrigger = true
            triggerValidationFailure(type: trigger)
        }
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
        switch sectionType {
        case .crashes:
            return crashTypes.count
        case .httpEvents:
            return httpEventTypes.count
        case .validationFailures:
            return validationFailureTypes.count
        case .appHangs:
            return appHangTypes.count
        }
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

        case .validationFailures:
            cell.textLabel?.text = validationFailureTypes[indexPath.row]
            cell.textLabel?.textColor = .systemOrange

        case .appHangs:
            cell.textLabel?.text = appHangTypes[indexPath.row]
            cell.textLabel?.textColor = .systemOrange
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
        case .validationFailures:
            triggerValidationFailure(type: validationFailureTypes[indexPath.row])
        case .appHangs:
            if indexPath.row == 0 {
                presentAppHangOptions(from: tableView.cellForRow(at: indexPath))
            } else {
                presentAllocatorHangOptions(from: tableView.cellForRow(at: indexPath))
            }
        }
    }

    // MARK: - App Hangs

    private func presentAppHangOptions(from sourceView: UIView?) {
        let alert = UIAlertController(title: "Block Main Thread",
                                      message: "Blocks the main thread for the selected duration.",
                                      preferredStyle: .actionSheet)

        // 1 second sits below the 2000ms detection threshold, so it should not be reported.
        let durations: [(String, TimeInterval)] = [("1 second (below threshold)", 1.0),
                                                   ("2.5 seconds", 2.5),
                                                   ("5 seconds", 5.0),
                                                   ("10 seconds", 10.0)]

        for (title, duration) in durations {
            alert.addAction(UIAlertAction(title: title, style: .default) { _ in
                Thread.sleep(forTimeInterval: duration)
            })
        }

        alert.addAction(UIAlertAction(title: "100 micro hangs (100 × 50ms)", style: .default) { _ in
            for _ in 0..<100 {
                DispatchQueue.main.async {
                    Thread.sleep(forTimeInterval: 0.05)
                }
            }
        })

        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))

        if let popover = alert.popoverPresentationController {
            popover.sourceView = sourceView ?? view
            popover.sourceRect = (sourceView ?? view).bounds
        }

        present(alert, animated: true)
    }

    private static let mallocForkPrepare: (@convention(c) () -> Void)? = {
        guard let symbol = dlsym(dlopen(nil, RTLD_NOW), "_malloc_fork_prepare") else { return nil }
        return unsafeBitCast(symbol, to: (@convention(c) () -> Void).self)
    }()

    private static let mallocForkParent: (@convention(c) () -> Void)? = {
        guard let symbol = dlsym(dlopen(nil, RTLD_NOW), "_malloc_fork_parent") else { return nil }
        return unsafeBitCast(symbol, to: (@convention(c) () -> Void).self)
    }()

    private func presentAllocatorHangOptions(from sourceView: UIView?) {
        let alert = UIAlertController(title: "Block Allocator Lock",
                                      message: "Blocks the main thread while holding every malloc zone lock, so any other thread that allocates blocks too.",
                                      preferredStyle: .actionSheet)

        for seconds in [5, 10, 20] {
            alert.addAction(UIAlertAction(title: "\(seconds) seconds", style: .destructive) { _ in
                Self.hangHoldingAllocatorLock(seconds: seconds)
            })
        }

        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))

        if let popover = alert.popoverPresentationController {
            popover.sourceView = sourceView ?? view
            popover.sourceRect = (sourceView ?? view).bounds
        }

        present(alert, animated: true)
    }

    static func hangHoldingAllocatorLock(seconds: Int) {
        guard let prepare = mallocForkPrepare, let parent = mallocForkParent else {
            NSLog("DemoApp: malloc fork handlers unavailable, cannot hold the allocator lock.")
            return
        }

        NSLog("DemoApp: locking all malloc zones for %d seconds", seconds)
        prepare()
        usleep(useconds_t(seconds) * 1_000_000)
        parent()
        NSLog("DemoApp: malloc zones unlocked")
    }

    // MARK: - Validation Failure Triggers

    func triggerValidationFailure(type: String) {
        switch type {
        case "Long user ID (129)":
            Measure.setUserId(String(repeating: "u", count: 129))

        case "Clear user ID":
            Measure.clearUserId()

        case "Attribute key with dot":
            Measure.trackEvent(name: "attr_key_dot", attributes: ["plan.type": .string("pro")], timestamp: nil)

        case "Attribute key empty":
            Measure.trackEvent(name: "attr_key_empty", attributes: ["": .string("value")], timestamp: nil)

        case "Span attribute key invalid":
            Measure.startSpan(name: "validation_span_attr")
                .setAttribute("bad key", value: "value")
                .end()

        case "Span empty name":
            Measure.startSpan(name: "").end()

        case "Long screen view name (1025)":
            Measure.trackScreenView(String(repeating: "s", count: 1025), attributes: nil)

        case "Long HTTP client (33)":
            let startTime = UInt64(Measure.getCurrentTime())
            Measure.trackHttpEvent(url: "https://api.example.com/validation",
                                   method: "get",
                                   startTime: startTime,
                                   endTime: startTime + 150,
                                   client: String(repeating: "c", count: 33),
                                   statusCode: 200)

        case "Long bug report description (4001)":
            Measure.trackBugReport(description: String(repeating: "d", count: 4001))

        case "Bug report with 6 attachments":
            let attachments = (0..<6).map { makeAttachment(name: "screenshot_\($0).png") }
            Measure.trackBugReport(description: "Bug report with 6 attachments", attachments: attachments)

        case "Bug report attribute key invalid":
            Measure.trackBugReport(description: "Bug report with invalid attribute key",
                                   attributes: ["a.b": .string("value")])

        case "Attachment with empty name":
            Measure.trackBugReport(description: "Bug report with empty attachment name",
                                   attachments: [makeAttachment(name: "")])

        case "Huge NSError userInfo (exception.meta)":
            let error = NSError(domain: "sh.measure.demoapp.validation",
                                code: 1,
                                userInfo: ["blob": String(repeating: "m", count: 5000)])
            Measure.trackError(error as Error)

        case "Custom event timestamp before session":
            Measure.trackEvent(name: "timestamp_before_session",
                               attributes: [:],
                               timestamp: Measure.getCurrentTime() - 86_400_000)

        case "Long thread name (129)":
            let longNamedQueue = DispatchQueue(label: String(repeating: "t", count: 129))
            let operationQueue = OperationQueue()
            operationQueue.underlyingQueue = longNamedQueue
            operationQueue.addOperation {
                withExtendedLifetime(longNamedQueue) {
                    Measure.trackEvent(name: "long_thread_name", attributes: [:], timestamp: nil)
                }
            }

        case "Gesture target / target_id screen":
            navigationController?.pushViewController(GestureValidationViewController(), animated: true)

        case "Long VC class name (>256)":
            let controller = ValidationGenericViewController<
                ValidationNestedTypeWithALongDescriptiveName<
                    ValidationNestedTypeWithALongDescriptiveName<
                        ValidationNestedTypeWithALongDescriptiveName<
                            ValidationNestedTypeWithALongDescriptiveName<
                                ValidationNestedTypeWithALongDescriptiveName<Int>>>>>>()
            navigationController?.pushViewController(controller, animated: true)

        case "Long SwiftUI view name (129)":
            let view = MsrMonitorView(String(repeating: "v", count: 129)) {
                Text("SwiftUI view with a 129 character name")
            }
            navigationController?.pushViewController(UIHostingController(rootView: view), animated: true)

        case "Long launched_activity (present, then background/foreground)":
            let controller = LaunchedActivityValidationViewControllerWithAnIntentionallyLongClassNameThatExceedsTheBackendLaunchedActivityLimitOfOneHundredTwentySevenCharacters()
            present(controller, animated: true)

        default:
            break
        }
    }

    private func makeAttachment(name: String) -> MsrAttachment {
        let bytes = UIImage(systemName: "star.fill")?.pngData() ?? Data([0])
        return MsrAttachment(name: name,
                             type: .screenshot,
                             size: Int64(bytes.count),
                             id: UUID().uuidString,
                             bytes: bytes)
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
        case "Track Handled NSException":
            DispatchQueue(label: "sh.measure.dempapp.background").async {
                let exception = NSException(name: NSExceptionName(rawValue: "NamedException"),
                                            reason: "Something happened",
                                            userInfo: nil)
                Measure.trackException(exception,
                                       attributes: ["swiftui": .boolean(true), "lat": .float(64.0), "long": .float(14.0), "string": .string("string")])
            }
        case "Track Handled NSError":
            DispatchQueue(label: "sh.measure.dempapp.background").async {
                do {
                    let path = "/path/that/does/not/exist.txt"
                    _ = try String(contentsOfFile: path, encoding: .utf8)
                } catch {
                    Measure.trackError(error)
                }
            }
        case "Track Swift Error (main thread)":
            do {
                let path = "/path/that/does/not/exist.txt"
                _ = try String(contentsOfFile: path, encoding: .utf8)
            } catch {
                Measure.trackError(error)
            }
        case "Track NSException (main thread)":
            let exception = NSException(name: NSExceptionName(rawValue: "NamedException"),
                                        reason: "Something happened on main thread",
                                        userInfo: ["key": "value"])
            Measure.trackException(exception, attributes: ["source": .string("swift-main-thread")])
        case "ObjC Runtime Lock Deadlock":
            replicateObjCRuntimeLockDeadlock()
        default:
            fatalError("Triggered crash: \(type)")
        }
    }

    private func replicateObjCRuntimeLockDeadlock() {
        let registrarThreadCount = 16

        for threadIndex in 0..<registrarThreadCount {
            Thread.detachNewThread {
                var counter = 0
                while true {
                    let className = "MSRDeadlockRepro_\(threadIndex)_\(counter)"
                    if let newClass = objc_allocateClassPair(NSObject.self, className, 0) {
                        objc_registerClassPair(newClass)
                    }
                    counter += 1
                }
            }
        }

        DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + 0.3) {
            abort()
        }
    }
}

// MARK: - Validation Failure Test Types

struct ValidationNestedTypeWithALongDescriptiveName<T> {}

final class ValidationGenericViewController<T>: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        title = "Long VC class name"
    }
}

final class LaunchedActivityValidationViewControllerWithAnIntentionallyLongClassNameThatExceedsTheBackendLaunchedActivityLimitOfOneHundredTwentySevenCharacters: UIViewController { // swiftlint:disable:this type_name
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let label = UILabel()
        label.text = "Background and foreground the app to trigger a launch event."
        label.numberOfLines = 0
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false

        let dismissButton = UIButton(type: .system)
        dismissButton.setTitle("Dismiss", for: .normal)
        dismissButton.addTarget(self, action: #selector(dismissTapped), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [label, dismissButton])
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16)
        ])
    }

    @objc private func dismissTapped() {
        dismiss(animated: true)
    }
}

final class GestureTargetValidationViewWithAnIntentionallyLongClassNameThatExceedsTheBackendGestureTargetLimitOfOneHundredTwentyEightCharacters: UIView {} // swiftlint:disable:this type_name

final class GestureValidationViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        title = "Gesture Validation"

        let longTargetView = GestureTargetValidationViewWithAnIntentionallyLongClassNameThatExceedsTheBackendGestureTargetLimitOfOneHundredTwentyEightCharacters()
        longTargetView.backgroundColor = .systemOrange

        let longTargetIdView = UIView()
        longTargetIdView.backgroundColor = .systemPurple
        longTargetIdView.accessibilityIdentifier = String(repeating: "i", count: 129)

        let stack = UIStackView(arrangedSubviews: [
            makeCaption("Tap the orange box: long target (131)"),
            longTargetView,
            makeCaption("Tap the purple box: long target_id (129)"),
            longTargetIdView
        ])
        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            longTargetView.heightAnchor.constraint(equalToConstant: 80),
            longTargetIdView.heightAnchor.constraint(equalToConstant: 80)
        ])
    }

    private func makeCaption(_ text: String) -> UILabel {
        let label = UILabel()
        label.text = text
        label.textAlignment = .center
        return label
    }
}
