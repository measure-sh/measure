//
//  MockIdProvider.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 02/09/24.
//

import Foundation
@testable import Measure

final class MockIdProvider: IdProvider {
    var idString: String

    func createId() -> String {
        return idString
    }

    init(_ id: String = "") {
        idString = id
    }
}
