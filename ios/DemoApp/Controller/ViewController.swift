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
    var span: Span?

    override func viewDidLoad() {
        super.viewDidLoad()
        span = Measure.shared.startSpan(name: "ViewControllerviewDidLoad")
        let attributes: [String: AttributeValue] = ["user_name": .string("Alice"),
                                                    "paid_user": .boolean(true),
                                                    "credit_balance": .int(1000),
                                                    "latitude": .double(30.2661403415387)]
        span?.setAttributes(attributes)

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

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        let attributes: [String: AttributeValue] = ["user_name": .string("Alice"),
                                                    "paid_user": .boolean(true),
                                                    "credit_balance": .int(1000),
                                                    "latitude": .double(30.2661403415387)]
        Measure.shared.trackEvent(name: "custom_event", attributes: attributes, timestamp: nil)
    }

    override func viewDidAppear(_ animated: Bool) {
        span?.end()
        super.viewDidAppear(animated)
        Measure.shared.trackScreenView("Home")
    }

    override func viewWillAppear(_ animated: Bool) {
        span?.setCheckpoint("ViewControllerviewWillAppear")
        super.viewWillAppear(animated)
    }
    // MARK: - Table Header View with Buttons

    func createTableHeaderView() -> UIView {
        let headerView = UIView(frame: CGRect(x: 0, y: 0, width: view.bounds.width, height: 150))

        let buttonTitles = ["SwiftUI Controller", "Objc Controller", "Collection Controller", "System Controls"]

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
        switch sender.tag {
        case 0:
            let swiftUIView = SwiftUIDetailViewController()
            let hostingController = UIHostingController(rootView: swiftUIView)
            self.navigationController?.pushViewController(hostingController, animated: true)
        case 1:
            let controller = ObjcDetailViewController()
            self.navigationController?.pushViewController(controller, animated: true)
        case 2:
            let controller = CollectionViewController()
            self.navigationController?.pushViewController(controller, animated: true)
        case 3:
            if let controller = self.storyboard?.instantiateViewController(withIdentifier: "ControlsViewController") {
                self.navigationController?.pushViewController(controller, animated: true)
            }
        default:
            let controller = ControlsViewController()
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

    func triggerCrash(type: String) { // swiftlint:disable:this cyclomatic_complexity function_body_length
        switch type {
        case "Abort":
            abort()
        case "Bad Pointer":
            let pointer = UnsafeMutableRawPointer(bitPattern: 0xdeadbeef)!
            pointer.storeBytes(of: 0, as: Int.self)
        case "Corrupt Memory":
            let array = [1, 2, 3]
            array.withUnsafeBufferPointer {
                _ = $0.baseAddress!.advanced(by: 4).pointee
            }
        case "Corrupt Object":
            let object: AnyObject = NSArray()
            let _ = object.perform(Selector(("invalidSelector"))) // swiftlint:disable:this redundant_discardable_let
        case "Deadlock":
            let queue = DispatchQueue(label: "deadlockQueue")
            queue.sync {
                queue.sync {}
            }
        case "NSException":
            let array = NSArray()
            print(array[1])
        case "Stack Overflow":
            func recurse() {
                recurse()
            }
            recurse()
        case "Zombie":
            var object: NSObject? = NSObject()
            let __weakObject = object // swiftlint:disable:this identifier_name
            object = nil
            print(__weakObject!.description)
        case "Zombie NSException":
            var exception: NSException? = NSException(name: .genericException, reason: "Test", userInfo: nil)
            let __weakException = exception // swiftlint:disable:this identifier_name
            exception = nil
            __weakException?.raise()
        case "Background thread crash":
            let backgroundQueue = DispatchQueue(label: "com.demo.backgroundQueue", qos: .background)
            backgroundQueue.async {
                let array = NSArray()
                print(array[1])
            }
        case "Segmentation Fault (SIGSEGV)":
            let pointer = UnsafeMutablePointer<Int>.allocate(capacity: 1)
            pointer.deallocate()
        case "Abnormal Termination (SIGABRT)":
            let array: [Int] = []
            print(array[1])
        case "Illegal Instruction (SIGILL)":
            let invalidInstruction: UnsafeMutablePointer<Void> = UnsafeMutablePointer(bitPattern: 0)!
            print("invalidInstruction.pointee: ", invalidInstruction.pointee)
        case "Bus Error (SIGBUS)":
            let invalidAddress = UnsafeMutableRawPointer(bitPattern: 0x1)
            invalidAddress!.storeBytes(of: 0, as: Int.self) // Attempting to write to an invalid memory address
        default:
            print("Unknown crash type.")
        }
    }
}

struct ViewControllerRepresentable: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> ViewController {
        return ViewController()
    }

    func updateUIViewController(_ uiViewController: ViewController, context: Context) {}
}
