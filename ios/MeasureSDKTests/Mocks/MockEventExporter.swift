//
//  MockEventExporter.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/10/24.
//

import Foundation
@testable import MeasureSDK

class MockEventExporter: EventExporter {
    var createBatchResult: BatchCreationResult?
    var existingBatches: [BatchEntity] = []
    var exportResponses: [String: HttpResponse] = [:]
    var exportEventsCalled = false
    var createBatchCalled = false
    var exportBatchId = ""

    func createBatch(_ sessionId: String?) -> BatchCreationResult? {
        createBatchCalled = true
        return createBatchResult
    }

    func getExistingBatches() -> [BatchEntity] {
        return existingBatches
    }

    func export(batchId: String, eventIds: [String]) -> HttpResponse? {
        exportEventsCalled = true
        exportBatchId = batchId
        return exportResponses[batchId]
    }

    func setCreateBatchResult(_ result: BatchCreationResult?) {
        createBatchResult = result
    }

    func setExistingBatches(_ batches: [BatchEntity]) {
        existingBatches = batches
    }

    func setExportResponse(for batchId: String, response: HttpResponse) {
        exportResponses[batchId] = response
    }
}
