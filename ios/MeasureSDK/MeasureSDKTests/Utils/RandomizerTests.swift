//
//  RandomizerTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import XCTest
@testable import MeasureSDK

final class RandomizerTests: XCTestCase {
    var randomizer: BaseRandomizer!

    override func setUp() {
        super.setUp()
        randomizer = BaseRandomizer()
    }

    override func tearDown() {
        randomizer = nil
        super.tearDown()
    }

    func testRandomNumberInRange() {
        let randomNumber = randomizer.random()

        XCTAssertGreaterThanOrEqual(randomNumber, 0.0, "Random number should be greater than or equal to 0.0")
        XCTAssertLessThanOrEqual(randomNumber, 1.0, "Random number should be less than or equal to 1.0")
    }
}
