//
//  MockCrashDataPersistence.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import Measure

final class MockCrashDataPersistence: CrashDataPersistence {
    var attribute: Attributes?
    var sessionId: String?
    var isForeground: Bool

    init(attribute: Attributes? = nil, sessionId: String? = nil, isForeground: Bool) {
        self.attribute = attribute
        self.sessionId = sessionId
        self.isForeground = isForeground
    }

    func prepareCrashFile() {}
    func writeCrashData() {}
    func readCrashData() -> CrashDataAttributes {
        return (attribute: attribute, sessionId: sessionId, isForeground: isForeground)
    }
    func clearCrashData() {
        attribute = nil
        sessionId = nil
        isForeground = true
    }
}
