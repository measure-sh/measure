//
//  SwizzlingUtilityTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 22/04/25.
//

import XCTest
@testable import Measure

final class SwizzlingUtilityTests: XCTestCase {
    /// Test that swizzling successfully swaps method implementations.
    func testSwizzleMethod() {
        class TestClass: NSObject {
            @objc dynamic func originalMethod() -> String {
                return "Original"
            }

            @objc dynamic func swizzledMethod() -> String {
                return "Swizzled"
            }
        }

        let testClass = TestClass()
        let originalSelector = #selector(TestClass.originalMethod)
        let swizzledSelector = #selector(TestClass.swizzledMethod)

        // Swizzle the methods
        SwizzlingUtility.swizzleMethod(for: TestClass.self, originalSelector: originalSelector, swizzledSelector: swizzledSelector)

        // Verify the swizzled implementation is called
        XCTAssertEqual(testClass.originalMethod(), "Swizzled", "Swizzled implementation should be called.")

        // Unswizzle and verify the original implementation is restored
        SwizzlingUtility.unswizzleAll()
        XCTAssertEqual(testClass.originalMethod(), "Original", "Original implementation should be restored.")
    }

    /// Test that duplicate swizzling is prevented.
    func testDuplicateSwizzlingPrevention() {
        class TestClass: NSObject {
            @objc dynamic func originalMethod() -> String {
                return "Original"
            }

            @objc dynamic func swizzledMethod() -> String {
                return "Swizzled"
            }
        }

        let testClass = TestClass()
        let originalSelector = #selector(TestClass.originalMethod)
        let swizzledSelector = #selector(TestClass.swizzledMethod)

        // Swizzle the methods
        SwizzlingUtility.swizzleMethod(for: TestClass.self, originalSelector: originalSelector, swizzledSelector: swizzledSelector)

        // Attempt to swizzle again
        SwizzlingUtility.swizzleMethod(for: TestClass.self, originalSelector: originalSelector, swizzledSelector: swizzledSelector)

        // Verify the swizzled implementation is still called
        XCTAssertEqual(testClass.originalMethod(), "Swizzled", "Swizzled implementation should still be called.")
    }

    /// Test that unswizzling restores the original implementation.
    func testUnswizzleAll() {
        class TestClass: NSObject {
            @objc dynamic func originalMethod() -> String {
                return "Original"
            }

            @objc dynamic func swizzledMethod() -> String {
                return "Swizzled"
            }
        }

        let testClass = TestClass()
        let originalSelector = #selector(TestClass.originalMethod)
        let swizzledSelector = #selector(TestClass.swizzledMethod)

        // Swizzle the methods
        SwizzlingUtility.swizzleMethod(for: TestClass.self, originalSelector: originalSelector, swizzledSelector: swizzledSelector)

        // Verify the swizzled implementation is called
        XCTAssertEqual(testClass.originalMethod(), "Swizzled", "Swizzled implementation should be called.")

        // Unswizzle all methods
        SwizzlingUtility.unswizzleAll()

        // Verify the original implementation is restored
        XCTAssertEqual(testClass.originalMethod(), "Original", "Original implementation should be restored.")
    }

    /// Test thread safety of swizzling.
    func testThreadSafety() {
        class ThreadSafetyTestClass: NSObject {
            @objc dynamic func originalMethod() -> String {
                return "Original"
            }

            @objc dynamic func swizzledMethod() -> String {
                return "Swizzled"
            }
        }

        let originalSelector = #selector(ThreadSafetyTestClass.originalMethod)
        let swizzledSelector = #selector(ThreadSafetyTestClass.swizzledMethod)

        DispatchQueue.concurrentPerform(iterations: 10) { _ in
            SwizzlingUtility.swizzleMethod(for: ThreadSafetyTestClass.self, originalSelector: originalSelector, swizzledSelector: swizzledSelector)
        }

        let testClass = ThreadSafetyTestClass()
        XCTAssertEqual(testClass.originalMethod(), "Swizzled", "Swizzled implementation should be called.")
    }

    /// Test swizzling a nonexistent method gracefully fails.
    func testSwizzlingNonexistentMethod() {
        class NonexistentMethodTestClass: NSObject {}

        let originalSelector = #selector(NSObject.description)
        let swizzledSelector = #selector(NSObject.description)

        // Attempt to swizzle a nonexistent method
        SwizzlingUtility.swizzleMethod(for: NonexistentMethodTestClass.self, originalSelector: originalSelector, swizzledSelector: swizzledSelector)

        // Verify no crash or unexpected behavior
        XCTAssertTrue(true, "Swizzling nonexistent method should not crash.")
    }
}
