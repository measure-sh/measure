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
    private var insertionOrder: [String] = []
    private let lock = NSLock()

    func insertBatch(_ batch: BatchEntity) -> Bool {
        lock.lock()
        defer { lock.unlock() }

        guard batches[batch.batchId] == nil else {
            return false
        }

        batches[batch.batchId] = batch
        insertionOrder.append(batch.batchId)
        return true
    }

    func getBatches(_ maxNumberOfBatches: Int) -> [BatchEntity] {
        lock.lock()
        defer { lock.unlock() }

        let ids = insertionOrder.prefix(maxNumberOfBatches)
        return ids.compactMap { batches[$0] }
    }

    func getBatch(_ batchId: String) -> BatchEntity? {
        lock.lock()
        defer { lock.unlock() }

        return batches[batchId]
    }

    func deleteBatch(_ batchId: String) {
        lock.lock()
        defer { lock.unlock() }

        batches.removeValue(forKey: batchId)
        insertionOrder.removeAll { $0 == batchId }
    }
}
