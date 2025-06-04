//
//  MockBatchStore.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 19/10/24.
//

import Foundation
@testable import Measure

final class MockBatchStore: BatchStore {
    var batches = [BatchEntity]()
    var insertBatchCalled = false
    var getBatchesCalled = false
    var deleteBatchCalled = false
    var deletedBatchId = ""

    func insertBatch(_ batch: BatchEntity, completion: @escaping (Bool) -> Void) {
        batches.append(batch)
        insertBatchCalled = true
        completion(insertBatchCalled)
    }

    func getBatches(_ maxNumberOfBatches: Int, completion: @escaping ([BatchEntity]) -> Void) {
        getBatchesCalled = true
        completion(Array(batches.prefix(maxNumberOfBatches)))
    }

    func deleteBatch(_ batchId: String) {
        deleteBatchCalled = true
        deletedBatchId = batchId
        batches.removeAll { $0.batchId == batchId }
    }
}
