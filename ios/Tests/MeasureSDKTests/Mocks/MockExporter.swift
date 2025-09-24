//
//  MockExporter.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/10/24.
//

import Foundation
@testable import Measure

class MockExporter: Exporter {
    var createBatchResult: BatchCreationResult?
    var existingBatches: [BatchEntity] = []
    var exportResponses: [String: HttpResponse] = [:]
    var exportEventsCalled = false
    var createBatchCalled = false
    var exportBatchId = ""

    func createBatch(_ sessionId: String?, completion: @escaping (BatchCreationResult?) -> Void) {
        createBatchCalled = true
        completion(createBatchResult)
    }

    func getExistingBatches(completion: @escaping ([BatchEntity]) -> Void) {
        completion(existingBatches)
    }

    func export(batchId: String, eventIds: [String], spanIds: [String], completion: @escaping (HttpResponse?) -> Void) {
        exportEventsCalled = true
        exportBatchId = batchId
        completion(exportResponses[batchId])
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
