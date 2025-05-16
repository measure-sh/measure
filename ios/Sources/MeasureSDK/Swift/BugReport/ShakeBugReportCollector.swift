//
//  ShakeBugReportCollector.swift
//  Measure
//
//  Created by Adwin Ross on 09/05/25.
//

import Foundation
import UIKit

final class ShakeBugReportCollector: ShakeDetectorListener {
    private let autoLaunchEnabled: Bool
    private let shakeDetector: ShakeDetector
    private let bugReportManager: BugReportManager
    private weak var listener: MsrShakeListener?
    private var autoLaunch = AtomicBool(false)
    private var takeScreenshot: Bool = false
    private let screenshotGenerator: ScreenshotGenerator

    init(autoLaunchEnabled: Bool, bugReportManager: BugReportManager, shakeDetector: ShakeDetector, screenshotGenerator: ScreenshotGenerator) {
        self.autoLaunchEnabled = autoLaunchEnabled
        self.shakeDetector = shakeDetector
        self.bugReportManager = bugReportManager
        self.screenshotGenerator = screenshotGenerator

        if autoLaunchEnabled {
            enableAutoLaunch(takeScreenshot: false)
        }
    }

    func enableAutoLaunch(takeScreenshot: Bool) {
        autoLaunch.set(true)
        self.takeScreenshot = takeScreenshot
        shakeDetector.setShakeListener(self)
        _ = shakeDetector.start()
    }

    func disableAutoLaunch() {
        autoLaunch.set(false)
        shakeDetector.setShakeListener(nil)
        shakeDetector.stop()
    }

    func setShakeListener(_ listener: MsrShakeListener?) {
        if autoLaunch.get() {
            return
        }
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
        if autoLaunch.get() {
            bugReportManager.openBugReporter([], takeScreenshot: takeScreenshot)
        } else if let listener = listener {
            listener.onShake()
        }
    }

    func isShakeToLaunchBugReportEnabled() -> Bool {
        return autoLaunch.get()
    }
}
