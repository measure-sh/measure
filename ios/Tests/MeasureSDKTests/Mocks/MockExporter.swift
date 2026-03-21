//
//  MockExporter.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/10/24.
//

import Foundation
@testable import Measure

final class MockExporter: Exporter {
    private(set) var exportCallCount = 0

    func export() {
        exportCallCount += 1
    }
}
