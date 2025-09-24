//
//  MockNetworkClient.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/10/24.
//

import Foundation
@testable import Measure

final class MockNetworkClient: NetworkClient {
    var shouldSucceed: Bool = true
    var response: HttpResponse? = .success(body: "events injected successfully.")
    var executedBatchId: String?
    var executedEvents: [EventEntity] = []
    var executeCalled = false

    func execute(batchId: String, events: [EventEntity], spans: [SpanEntity]) -> HttpResponse {
        executeCalled = true
        executedBatchId = batchId
        executedEvents = events
        return shouldSucceed ? .success(body: "events injected successfully.") : response!
    }
}
