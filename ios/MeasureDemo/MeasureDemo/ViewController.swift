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
        "Zombie NSException"
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

    func triggerCrash(type: String) {
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
        default:
            break
        }
    }
}
