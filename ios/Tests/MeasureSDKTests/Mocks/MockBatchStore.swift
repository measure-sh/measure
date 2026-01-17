//
//  MockBatchStore.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 19/10/24.
//

import Foundation
@testable import Measure

final class MockBatchStore: BatchStore {
    private var batches: [String: BatchEntity] = [:]
    private(set) var insertCallCount = 0
    private(set) var deleteCallCount = 0

    var onInsert: ((BatchEntity) -> Void)?
    var onDelete: ((String) -> Void)?

    func insertBatch(_ batch: BatchEntity) -> Bool {
        insertCallCount += 1
        batches[batch.batchId] = batch
        onInsert?(batch)
        return true
    }

    func getBatches(_ maxNumberOfBatches: Int) -> [BatchEntity] {
        return Array(batches.values.prefix(maxNumberOfBatches))
    }

    func getBatch(_ batchId: String) -> BatchEntity? {
        return batches[batchId]
    }

    func deleteBatch(_ batchId: String) {
        deleteCallCount += 1
        batches.removeValue(forKey: batchId)
        onDelete?(batchId)
    }
}
