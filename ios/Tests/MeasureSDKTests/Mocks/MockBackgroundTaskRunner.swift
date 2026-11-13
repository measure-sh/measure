//
//  MockBackgroundTaskRunner.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 11/11/26.
//

import UIKit
@testable import Measure

final class MockBackgroundTaskRunner: BackgroundTaskRunner {
    private(set) var begunTaskIds: [UIBackgroundTaskIdentifier] = []
    private(set) var endedTaskIds: [UIBackgroundTaskIdentifier] = []
    private var expirationHandlers: [UIBackgroundTaskIdentifier: () -> Void] = [:]

    func begin(name: String, onExpiration: @escaping () -> Void) -> UIBackgroundTaskIdentifier {
        let taskId = UIBackgroundTaskIdentifier(rawValue: begunTaskIds.count + 1)
        begunTaskIds.append(taskId)
        expirationHandlers[taskId] = onExpiration
        return taskId
    }

    func end(_ taskId: UIBackgroundTaskIdentifier) {
        endedTaskIds.append(taskId)
    }

    func expire(_ taskId: UIBackgroundTaskIdentifier) {
        expirationHandlers[taskId]?()
    }
}
