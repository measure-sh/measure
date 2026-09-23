//
//  MockAppHangStackCapture.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/09/26.
//

import Foundation
@testable import Measure

final class MockAppHangStackCapture: AppHangStackCapture {
    private let lock = NSLock()
    private var captures = 0

    /// Returned from `capture()`. Set to `nil` to simulate a failed walk of the main thread.
    var stack: AppHangStack? = AppHangStack(
        frames: [
            StackFrame(binaryName: "DemoApp",
                       binaryAddress: "0000000104a10000",
                       offset: 64,
                       frameIndex: 0,
                       symbolAddress: "0000000104a3f5c0",
                       inApp: true,
                       className: nil,
                       methodName: nil,
                       fileName: nil,
                       lineNumber: nil,
                       columnNumber: nil,
                       moduleName: nil,
                       instructionAddress: nil)
        ],
        binaryImages: [
            BinaryImage(startAddress: "0000000104a10000",
                        endAddress: "0000000104b8ffff",
                        baseAddress: nil,
                        system: false,
                        name: "DemoApp",
                        arch: "arm64",
                        uuid: "b1f4c9a23d773f0e9c215a8e7d64b019",
                        path: "/private/var/containers/Bundle/Application/DemoApp.app/DemoApp")
        ]
    )

    var captureCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return captures
    }

    func capture() -> AppHangStack? {
        lock.lock()
        captures += 1
        lock.unlock()
        return stack
    }
}
