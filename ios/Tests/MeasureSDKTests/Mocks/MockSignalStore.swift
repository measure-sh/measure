//
//  MockSignalStore.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 17/01/26.
//

import Foundation
@testable import Measure

final class MockSignalStore: SignalStore {
    private(set) var storedEvents: [EventEntity] = []
    var onStoreEvent: ((EventEntity) -> Void)?

    private(set) var storedSpans: [SpanEntity] = []
    var onStoreSpan: ((SpanEntity) -> Void)?

    func store<T>(_ event: Event<T>, needsReporting: Bool) where T: Codable {
        let eventEntity = EventEntity(event, needsReporting: needsReporting)
        storedEvents.append(eventEntity)

        onStoreEvent?(eventEntity)
    }

    func store(_ span: SpanEntity) {
        storedSpans.append(span)

        onStoreSpan?(span)
    }
}
