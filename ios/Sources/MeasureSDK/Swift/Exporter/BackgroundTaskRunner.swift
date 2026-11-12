//
//  BackgroundTaskRunner.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 11/11/26.
//

import UIKit

/// Begins and ends background tasks
protocol BackgroundTaskRunner {
    func begin(name: String, onExpiration: @escaping () -> Void) -> UIBackgroundTaskIdentifier
    func end(_ taskId: UIBackgroundTaskIdentifier)
}

final class BaseBackgroundTaskRunner: BackgroundTaskRunner {
    func begin(name: String, onExpiration: @escaping () -> Void) -> UIBackgroundTaskIdentifier {
        UIApplication.shared.beginBackgroundTask(withName: name) { onExpiration() }
    }

    func end(_ taskId: UIBackgroundTaskIdentifier) {
        UIApplication.shared.endBackgroundTask(taskId)
    }
}
