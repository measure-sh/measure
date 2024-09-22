//
//  ViewController.swift
//  MeasureDemo
//
//  Created by Adwin Ross on 12/08/24.
//

import UIKit

class ViewController: UIViewController, UITableViewDelegate, UITableViewDataSource {
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

        let tableView = UITableView(frame: view.bounds, style: .plain)
        tableView.delegate = self
        tableView.dataSource = self

        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")

        view.addSubview(tableView)
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
