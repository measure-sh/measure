//
//  MockLayoutSnapshotCollector.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 10/09/26.
//

@testable import Measure

final class MockLayoutSnapshotCollector: LayoutSnapshotCollector {
    var attachment: MsrAttachment?
    var captureCallCount = 0

    func captureAttachment(completion: @escaping (MsrAttachment?) -> Void) {
        captureCallCount += 1
        completion(attachment)
    }
}
