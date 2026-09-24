//
//  AppHangDetector.swift
//  Measure
//
//  Created by Adwin Ross on 21/09/26.
//

import Foundation

/// Detects periods where the main thread is unresponsive for longer than
/// `ConfigProvider.appHangThresholdMillis`.
///
/// `PingAppHangDetector` is the only implementation. It dispatches a probe to the main queue and
/// times it, rather than bracketing run loop activity with a `CFRunLoopObserver`. Both approaches
/// were built and measured during the POC; the ping won because:
///
/// - A run loop observer can silently miss hangs. Work started from another observer ordered after
///   ours is invisible to us, which is how Bugsnag missed hangs inside `didSelectRowAtIndexPath`
///   (bugsnag-cocoa#1029). A high `order` mitigates the known case but leaves us racing UIKit.
///   Missing a hang is the worse failure for an observability SDK: nobody notices data that never
///   arrived.
/// - The main queue probe is the signal vendors fall back to as ground truth. Sentry's fix for the
///   false positives in their frame based detector was to re-add it (sentry-cocoa#8840).
/// - Its two weaknesses, idle wakeups and duration undershoot, are the same knob traded against
///   each other via `idleIntervalFactor`, so we choose the point on that curve. Datadog documents
///   the same trade off publicly: hangs lasting close to the threshold may go unreported.
/// - It is far simpler. The run loop implementation shares state across two threads and produced a
///   real duration reporting bug during the POC.
///
/// The one thing that would reverse this is reporting at Apple's 250ms "micro hang" tier, where
/// the ping's cost grows as the threshold shrinks while an observer's stays flat.
protocol AppHangDetector: AnyObject {
    var callbacks: AppHangCallbacks? { get set }

    func enable()
    func disable()
}

/// Receives hangs from the detector thread. Kept separate so the detector stays about timing and
/// knows nothing about events, sessions or storage.
protocol AppHangCallbacks: AnyObject {
    /// The main thread has been blocked for longer than the threshold. Called from the detector
    /// thread while the thread is still blocked, and must not return until the hang is durably
    /// recorded: the process can die at any point after this.
    func onAppHangStarted(stack: AppHangStack?, thresholdMs: Number, timestamp: Number)

    /// The main thread is still blocked, and has been for `elapsedMs`. Called about once per
    /// heartbeat interval so that a hang the process does not survive still carries a duration.
    func onAppHangHeartbeat(elapsedMs: Number)

    /// The main thread resumed. `durationMs` is how long it was actually blocked.
    func onAppHangEnded(durationMs: Number)

    /// A hang already reported through `onAppHangStarted` turned out to be an artifact. Its record
    /// must be thrown away, or the next launch would find it pending and report it as fatal.
    func onAppHangDiscarded(reason: String)
}

enum AppHangConstants {
    /// A wake up later than `threshold * oversleepFactor` means the detector thread itself was
    /// descheduled, which happens when the whole process is suspended, so the observation is
    /// discarded rather than reported as a hang.
    static let oversleepFactor: Double = 1.5

    /// Hangs of this length or longer are treated as measurement artifacts. iOS terminates a
    /// genuinely hung foreground app well before this, so anything longer points at process
    /// suspension. Applied both while running and to records found at the next launch.
    static let falsePositiveCeilingMs: Double = 30_000

    /// How often the elapsed time of an in-progress hang is written to disk. The reported duration
    /// of a hang the process does not survive is therefore accurate to within this interval, and
    /// always rounds down.
    static let heartbeatIntervalMs: Double = 1_000

    /// Fraction of the threshold to sleep between polls. Without a sleep the detector thread
    /// spins at ~100% CPU.
    static let idleIntervalFactor: Double = 0.025

    /// Floor on the gap between polls, and the SDK's real cost rail.
    ///
    /// The probe rate is `1 / idleInterval`, so cost depends on this and not on the threshold —
    /// the threshold only sets the timeout. Deriving the interval from the threshold alone would
    /// make a more sensitive threshold proportionally more expensive; this caps that. It is the
    /// value the 2s default already produces, so it changes nothing at the default and only bites
    /// for thresholds below 2s.
    static let minIdleIntervalMs: Double = 50

    /// How long to sleep between polls for a given threshold.
    ///
    /// The cost of a lower threshold is paid in duration accuracy rather than wake-ups: a hang is
    /// noticed up to one interval late, so its reported duration undershoots by up to that much.
    static func idleIntervalMs(forThresholdMs thresholdMs: Double) -> Double {
        max(thresholdMs * idleIntervalFactor, minIdleIntervalMs)
    }

    /// Maximum frames captured from the blocked main thread.
    static let maxFrames = 128

    /// Present in the environment only when running under XCTest.
    static let xctestEnvKey = "XCTestConfigurationFilePath"
}
