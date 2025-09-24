//
//  MockBatchCreator.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/10/24.
//

import Foundation
@testable import Measure

final class MockBatchCreator: BatchCreator {
    var shouldCreateBatch: Bool = true
    var createdBatchId: String = "mockBatchId"
    var createdEventIds: [String] = ["event1", "event2"]
    var createdSpanIds: [String] = ["span1", "span2"]
    var batchCreationResult: BatchCreationResult?

    func create(sessionId: String?, completion: @escaping (BatchCreationResult?) -> Void) {
        if shouldCreateBatch {
            completion((batchId: createdBatchId, eventIds: createdEventIds, spanIds: createdSpanIds))
        } else {
            completion(nil)
        }
    }
}
