//
//  MockIdProvider.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation
@testable import Measure

final class MockIdProvider: IdProvider {
    var uuId: String = ""
    var spanid: String = ""
    var traceid: String = ""

    func uuid() -> String {
        return uuId
    }

    func spanId() -> String {
        return spanid
    }

    func traceId() -> String {
        return traceid
    }
}
