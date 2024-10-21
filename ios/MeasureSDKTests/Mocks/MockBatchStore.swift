//
//  MockBatchStore.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 19/10/24.
//

import Foundation
@testable import MeasureSDK

final class MockBatchStore: BatchStore {
    var batches = [BatchEntity]()
    var insertBatchCalled = false
    var getBatchesCalled = false
    var deleteBatchCalled = false
    var deletedBatchId = ""

    func insertBatch(_ batch: BatchEntity) -> Bool {
        batches.append(batch)
        insertBatchCalled = true
        return true
    }

    func getBatches(_ maxNumberOfBatches: Int) -> [BatchEntity] {
        getBatchesCalled = true
        return Array(batches.prefix(maxNumberOfBatches))
    }

    func deleteBatch(_ batchId: String) {
        deleteBatchCalled = true
        deletedBatchId = batchId
        batches.removeAll { $0.batchId == batchId }
    }
}
