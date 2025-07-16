//
//  ShakeBugReportCollector.swift
//  Measure
//
//  Created by Adwin Ross on 09/05/25.
//

import Foundation
import UIKit

final class ShakeBugReportCollector: ShakeDetectorListener {
    private let shakeDetector: ShakeDetector
    private var shakeHandler: (() -> Void)?

    init(shakeDetector: ShakeDetector) {
        self.shakeDetector = shakeDetector
    }

    func setShakeHandler(_ handler: (() -> Void)?) {
        self.shakeHandler = handler
        if handler == nil {
            shakeDetector.setShakeListener(nil)
            shakeDetector.stop()
        } else {
            shakeDetector.setShakeListener(self)
            _ = shakeDetector.start()
        }
    }

    func onShake() {
        shakeHandler?()
    }
}
