//
//  MockCrashDataPersistence.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import MeasureSDK

final class MockCrashDataPersistence: CrashDataPersistence {
    var attribute: MeasureSDK.Attributes?
    var sessionId: String?
    var isForeground: Bool

    init(attribute: MeasureSDK.Attributes? = nil, sessionId: String? = nil, isForeground: Bool) {
        self.attribute = attribute
        self.sessionId = sessionId
        self.isForeground = isForeground
    }

    func prepareCrashFile() {}
    func writeCrashData() {}
    func readCrashData() -> MeasureSDK.CrashDataAttributes {
        return (attribute: attribute, sessionId: sessionId, isForeground: isForeground)
    }
    func clearCrashData() {
        attribute = nil
        sessionId = nil
        isForeground = true
    }
}
