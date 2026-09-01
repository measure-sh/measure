//
//  MockNetworkClient.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/10/24.
//

import Foundation
@testable import Measure

final class MockNetworkClient: NetworkClient {
    private(set) var lastBatchId: String?
    private(set) var lastEvents: [EventEntity] = []
    private(set) var lastSpans: [SpanEntity] = []
    private(set) var lastETag: String?
    private(set) var executedBatchIds: [String] = []
    private(set) var executedEventCounts: [Int] = []
    private(set) var executedSpanCounts: [Int] = []

    var executeResponse: HttpResponse = .success(body: nil, eTag: nil, cacheControl: nil)
    var configResponse: ConfigResponse = .notModified(cacheControl: 0)

    func execute(batchId: String, events: [EventEntity], spans: [SpanEntity]) -> HttpResponse {
        executedBatchIds.append(batchId)
        executedEventCounts.append(events.count)
        executedSpanCounts.append(spans.count)
        lastBatchId = batchId
        lastEvents = events
        lastSpans = spans
        return executeResponse
    }

    func getConfig(eTag: String?) -> ConfigResponse {
        lastETag = eTag
        return configResponse
    }

    func reset() {
        lastBatchId = nil
        lastEvents = []
        lastSpans = []
        lastETag = nil
        executeResponse = .success(body: nil, eTag: nil, cacheControl: nil)
        configResponse = .notModified(cacheControl: 0)
        executedBatchIds = []
        executedEventCounts = []
        executedSpanCounts = []
    }

    func stubExecuteSuccess(body: String? = nil, eTag: String? = nil) {
        executeResponse = .success(body: body, eTag: eTag, cacheControl: nil)
    }

    func stubExecuteError(_ error: HttpError) {
        executeResponse = .error(error)
    }

    func stubConfig(_ configResponse: ConfigResponse) {
        self.configResponse = configResponse
    }
}
