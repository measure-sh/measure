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
    private let bugReportManager: BugReportManager
    private var listener: MsrShakeListener?
    private var takeScreenshot: Bool = false
    private let screenshotGenerator: ScreenshotGenerator

    init(bugReportManager: BugReportManager, shakeDetector: ShakeDetector, screenshotGenerator: ScreenshotGenerator) {
        self.shakeDetector = shakeDetector
        self.bugReportManager = bugReportManager
        self.screenshotGenerator = screenshotGenerator
    }

    func setShakeListener(_ listener: MsrShakeListener?) {
        self.listener = listener
        if listener == nil {
            shakeDetector.setShakeListener(nil)
            shakeDetector.stop()
        } else {
            shakeDetector.setShakeListener(self)
            _ = shakeDetector.start()
        }
    }

    func onShake() {
        if let listener = listener {
            listener.onShake()
        }
    }
}
