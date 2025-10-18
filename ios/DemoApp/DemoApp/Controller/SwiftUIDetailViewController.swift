//
//  SwiftUIDetailViewController.swift
//  MeasureDemo
//
//  Created by Adwin Ross on 27/09/24.
//

import Measure
import SwiftUI
import UIKit

struct SwiftUIDetailViewController: View {
    let crashTypes = [
        "Trigger Http Event",
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

    var body: some View {
        MsrMoniterView("DetailListView") {
            NavigationView {
                VStack {
                    List(crashTypes, id: \.self) { crashType in
                        Text(crashType)
                            .onTapGesture {
                                triggerCrash(type: crashType)
                            }
                    }
                    .navigationBarTitle("SwiftUI View Controller", displayMode: .inline)
                }
            }
        }
    }

    // MARK: - Crash Triggers

    func triggerCrash(type: String) { // swiftlint:disable:this cyclomatic_complexity function_body_length
        switch type {
        case "Trigger Http Event":
            let startTime = Measure.getCurrentTime()
            Measure.trackHttpEvent(url: "https://www.linkedin.com/feed/",
                                   method: "get",
                                   startTime: UInt64(startTime),
                                   endTime: UInt64(Measure.getCurrentTime()))
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
            invalidAddress!.storeBytes(of: 0, as: Int.self)
        default:
            print("Unknown crash type.")
        }
    }
}

func pushViewController(_ controller: UIViewController) {
    if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
        if let rootViewController = windowScene.windows.first?.rootViewController as? UINavigationController {
            rootViewController.pushViewController(controller, animated: true)
        }
    }
}

@objc public class SwiftUIWrapper: NSObject {
    @objc public func createSwiftUIViewController() -> UIViewController {
        let swiftUIView = SwiftUIDetailViewController()
        let hostingController = UIHostingController(rootView: swiftUIView)
        return hostingController
    }
}

#Preview {
    SwiftUIDetailViewController()
}
