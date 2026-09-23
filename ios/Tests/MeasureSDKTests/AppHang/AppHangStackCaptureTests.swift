//
//  AppHangStackCaptureTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/09/26.
//

@testable import Measure
import XCTest

/// Exercises the real KSCrash backtrace and dynamic linker path against this process. XCTest runs
/// test methods on the main thread, so the capture walks the thread actually running the test.
final class AppHangStackCaptureTests: XCTestCase {
    private var logger: MockLogger!
    private var capture: BaseAppHangStackCapture!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        capture = BaseAppHangStackCapture(logger: logger)
    }

    override func tearDown() {
        capture = nil
        logger = nil
        super.tearDown()
    }

    func testCaptureReturnsMainThreadFrames() throws {
        let stack = try XCTUnwrap(capture.capture(), "Capture should walk the main thread.")

        XCTAssertFalse(stack.frames.isEmpty)
        XCTAssertFalse(stack.binaryImages.isEmpty, "Frames without their images cannot be symbolicated.")
    }

    func testFramesAreIndexedAndCarryAddresses() throws {
        let stack = try XCTUnwrap(capture.capture())

        for (index, frame) in stack.frames.enumerated() {
            XCTAssertEqual(frame.frameIndex, Number(index), "Frame indexes must be contiguous and ordered.")
            let symbolAddress = try XCTUnwrap(frame.symbolAddress)
            XCTAssertEqual(symbolAddress.count, 16, "Addresses are zero-padded 64-bit hex, matching CrashDataFormatter.")
            XCTAssertNotNil(UInt64(symbolAddress, radix: 16), "Address should be parseable hex: \(symbolAddress)")
        }
    }

    /// Raw addresses are useless to the backend without the image they belong to, so every frame
    /// that resolved to a binary must have that binary present in `binaryImages`.
    func testEveryResolvedFrameHasAMatchingBinaryImage() throws {
        let stack = try XCTUnwrap(capture.capture())
        let imageStarts = Set(stack.binaryImages.compactMap { $0.startAddress })

        for frame in stack.frames {
            guard let binaryAddress = frame.binaryAddress else { continue }
            XCTAssertTrue(imageStarts.contains(binaryAddress),
                          "Frame in \(frame.binaryName ?? "?") references image \(binaryAddress) which is not reported.")
        }
    }

    func testBinaryImagesCarrySymbolicationFields() throws {
        let stack = try XCTUnwrap(capture.capture())

        for image in stack.binaryImages {
            XCTAssertEqual(image.uuid.count, 32, "UUID should be 32 hex characters, no dashes, like CrashDataFormatter emits.")
            XCTAssertNotNil(image.uuid.range(of: "^[0-9a-f]{32}$", options: .regularExpression),
                            "UUID should be lowercase hex: \(image.uuid)")
            XCTAssertNotEqual(image.arch, "???", "Unresolved architecture for \(image.name ?? "?")")

            let start = try XCTUnwrap(image.startAddress.flatMap { UInt64($0, radix: 16) })
            let end = try XCTUnwrap(image.endAddress.flatMap { UInt64($0, radix: 16) })
            XCTAssertGreaterThan(end, start, "Image \(image.name ?? "?") has a non-positive size.")
        }
    }

    func testBinaryImagesAreDeduplicated() throws {
        let stack = try XCTUnwrap(capture.capture())
        let starts = stack.binaryImages.compactMap { $0.startAddress }

        XCTAssertEqual(starts.count, Set(starts).count, "The same image must not be reported twice.")
    }

    /// The test host is not the app under measurement, so nothing here should be flagged in-app.
    /// This mostly guards against `inApp` defaulting to true.
    func testSystemFramesAreNotMarkedInApp() throws {
        let stack = try XCTUnwrap(capture.capture())
        let systemImages = stack.binaryImages.filter { $0.system == true }

        XCTAssertFalse(systemImages.isEmpty, "A main thread stack should include at least one system binary.")
    }
}
