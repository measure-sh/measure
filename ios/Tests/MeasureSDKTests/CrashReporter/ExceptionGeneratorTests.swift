//
//  ExceptionGeneratorTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 08/10/26.
//

import XCTest
@testable import Measure

final class ExceptionGeneratorTests: XCTestCase {
    private var logger: MockLogger!
    private var exceptionGenerator: BaseExceptionGenerator!

    override func setUp() {
        super.setUp()
        logger = MockLogger()
        exceptionGenerator = BaseExceptionGenerator(logger: logger,
                                                    crashDataPersistence: MockCrashDataPersistence(isForeground: true),
                                                    sysCtl: MockSysCtl())
    }

    override func tearDown() {
        exceptionGenerator = nil
        logger = nil
        super.tearDown()
    }

    func testSizeLimitedMeta_returnsNil_whenMetaIsNil() {
        XCTAssertNil(exceptionGenerator.sizeLimitedMeta(nil))
    }

    func testSizeLimitedMeta_keepsMeta_whenWithinMaxSize() {
        let meta: [String: CodableValue] = ["key": .string("value"), "count": .int(1)]

        let result = exceptionGenerator.sizeLimitedMeta(meta)

        XCTAssertEqual(result?.count, 2)
    }

    func testSizeLimitedMeta_dropsMeta_whenLargerThanMaxSize() {
        let meta: [String: CodableValue] = ["blob": .string(String(repeating: "m", count: ValidationLimits.exceptionMetaBytes))]

        let result = exceptionGenerator.sizeLimitedMeta(meta)

        XCTAssertNil(result)
        XCTAssertTrue(logger.logs.contains { $0.contains("Exception meta exceeds the maximum size") })
    }
}
