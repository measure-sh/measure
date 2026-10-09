//
//  AppHangDetector.swift
//  Measure
//
//  Created by Adwin Ross on 21/09/26.
//

import Foundation

protocol AppHangDetector: AnyObject {
    var callbacks: AppHangCallbacks? { get set }
    func enable()
    func disable()
}

protocol AppHangCallbacks: AnyObject {
    func onAppHangStarted(stack: AppHangStack?, thresholdMs: Number, timestamp: Number)
    func onAppHangHeartbeat(elapsedMs: Number)
    func onAppHangEnded(durationMs: Number)
    func onAppHangDiscarded(reason: String)
}

enum AppHangConstants {
    static let oversleepFactor: Double = 1.5
    static let falsePositiveCeilingMs: Double = 30_000
    static let heartbeatIntervalMs: Double = 1_000
    static let idleIntervalFactor: Double = 0.025
    static let minIdleIntervalMs: Double = 50
    static let maxFrames = 128
    static let xctestEnvKey = "XCTestConfigurationFilePath"
    static func idleIntervalMs(forThresholdMs thresholdMs: Double) -> Double {
        max(thresholdMs * idleIntervalFactor, minIdleIntervalMs)
    }
}
