//
//  MockSpanProcessor.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 13/04/25.
//

import Foundation
@testable import Measure
import XCTest

final class MockSpanProcessor: SpanProcessor {
    private(set) var startedSpans: [InternalSpan] = []
    private(set) var endingSpans: [InternalSpan] = []
    private(set) var endedSpans: [InternalSpan] = []

    func onStart(_ span: InternalSpan) {
        startedSpans.append(span)
    }

    func onEnding(_ span: InternalSpan) {
        endingSpans.append(span)
    }

    func onEnded(_ span: InternalSpan) {
        endedSpans.append(span)
    }

    func verifyOnStartCalled(with span: InternalSpan) {
        XCTAssertTrue(startedSpans.contains(where: { $0.spanId == span.spanId }),
                      "Expected onStart to be called with span ID \(span.spanId), but it wasn't.")
    }

    func verifyOnEndingAndEndedCalled(with span: InternalSpan) {
        XCTAssertTrue(endingSpans.contains(where: { $0.spanId == span.spanId }),
                      "Expected onEnding to be called with span ID \(span.spanId), but it wasn't.")
        XCTAssertTrue(endedSpans.contains(where: { $0.spanId == span.spanId }),
                      "Expected onEnded to be called with span ID \(span.spanId), but it wasn't.")
    }

    func reset() {
        startedSpans.removeAll()
        endingSpans.removeAll()
        endedSpans.removeAll()
    }
}
