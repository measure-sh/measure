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

    func getConfig(eTag: String?) -> DynamicConfig? {
        let dynamicConfig = BaseDynamicConfig(maxEventsInBatch: 10_000,
                                              crashTimelineDurationSeconds: 300,
                                              anrTimelineDurationSeconds: 300,
                                              bugReportTimelineDurationSeconds: 300,
                                              traceSamplingRate: 0.01,
                                              journeySamplingRate: 0.01,
                                              screenshotMaskLevel: .allTextAndMedia,
                                              cpuUsageInterval: 5,
                                              memoryUsageInterval: 5,
                                              crashTakeScreenshot: true,
                                              anrTakeScreenshot: true,
                                              launchSamplingRate: 0.01,
                                              gestureClickTakeSnapshot: true,
                                              httpDisableEventForUrls: [],
                                              httpTrackRequestForUrls: [],
                                              httpTrackResponseForUrls: [],
                                              httpBlockedHeaders: [])

        return dynamicConfig
    }
}
