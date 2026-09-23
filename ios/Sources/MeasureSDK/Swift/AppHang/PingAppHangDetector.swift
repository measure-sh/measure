//
//  PingAppHangDetector.swift
//  Measure
//
//  Created by Adwin Ross on 21/09/26.
//

import Foundation

/// Detects app hangs by dispatching a probe to the main queue and measuring how long it takes to
/// run. If the probe does not run within the threshold, the main thread is blocked.
///
/// Measures main queue drain latency, so it reports both a single long block and a sustained
/// backlog of short work items. Both leave the app unresponsive to the user.
///
/// See `AppHangDetector` for why this approach was chosen over a run loop observer.
final class PingAppHangDetector: AppHangDetector {
    private let logger: Logger
    private let configProvider: ConfigProvider
    private let stackCapture: AppHangStackCapture
    private let timeProvider: TimeProvider
    private let environment: [String: String]

    weak var callbacks: AppHangCallbacks?

    private var isEnabled = AtomicBool(false)
    private var thread: Thread?

    init(logger: Logger,
         configProvider: ConfigProvider,
         stackCapture: AppHangStackCapture,
         timeProvider: TimeProvider,
         environment: [String: String] = ProcessInfo.processInfo.environment) {
        self.logger = logger
        self.configProvider = configProvider
        self.stackCapture = stackCapture
        self.timeProvider = timeProvider
        self.environment = environment
    }

    func enable() {
        guard let skipReason = detectionSkipReason() else {
            startThread()
            return
        }

        logger.log(level: .debug, message: "AppHang: detection disabled, \(skipReason).", error: nil, data: nil)
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            // The thread only observes cancellation on its next loop iteration, and while a hang is
            // in progress it is parked in an unbounded wait, so teardown is not immediate.
            thread?.cancel()
            thread = nil

            logger.log(level: .debug, message: "AppHang: detection disabled.", error: nil, data: nil)
        }
    }

    private func startThread() {
        isEnabled.setTrueIfFalse {
            guard thread == nil else { return }

            let thread = Thread { [weak self] in
                self?.detectHangs()
            }
            thread.name = "sh.measure.app-hang-ping"
            self.thread = thread
            thread.start()

            logger.log(level: .debug,
                               message: "AppHang: detection enabled, threshold \(configProvider.appHangThresholdMillis)ms.",
                               error: nil,
                               data: nil)
        }
    }

    /// Why detection should not run, or `nil` when it should.
    ///
    /// Deliberately does not skip when a debugger is attached, matching Datadog. Sentry and
    /// Embrace do skip, on the grounds that a paused process is indistinguishable from a hung one;
    /// the trade accepted here is that stepping through main-thread code in Xcode will be reported
    /// as a hang. Long pauses are still filtered by the oversleep guard and the duration ceiling.
    ///
    /// Deliberately does not test `UIApplication.applicationState`. That reads `.background`
    /// during `didFinishLaunching` on an ordinary cold launch, not just on a background launch,
    /// so gating on it would defer the detector until `willEnterForeground` and miss launch hangs
    /// — one of the cases worth catching most. Backgrounding is handled by the transition instead:
    /// `MeasureInternal` calls `disable()` from `applicationDidEnterBackground`, and a process
    /// suspended while detection is still running is caught by the oversleep guard and the
    /// duration ceiling in `detectHangs()`.
    private func detectionSkipReason() -> String? {
        if environment[AppHangConstants.xctestEnvKey] != nil {
            return "running under XCTest"
        }
        if isRunningInAppExtension() {
            return "running in an app extension"
        }
        return nil
    }

    private func isRunningInAppExtension() -> Bool {
        Bundle.main.bundlePath.hasSuffix(".appex")
    }

    private func detectHangs() {
        while !Thread.current.isCancelled {
            let thresholdMs = Double(configProvider.appHangThresholdMillis)
            let semaphore = DispatchSemaphore(value: 0)
            let waitStart = DispatchTime.now()

            DispatchQueue.main.async {
                semaphore.signal()
            }

            if semaphore.wait(timeout: waitStart + .milliseconds(Int(thresholdMs))) == .success {
                Thread.sleep(forTimeInterval: AppHangConstants.idleIntervalMs(forThresholdMs: thresholdMs) / 1000)
                continue
            }

            // The probe did not run in time. Check that this thread itself was not descheduled,
            // which is what happens when the whole process is suspended.
            if elapsedMs(since: waitStart) > thresholdMs * AppHangConstants.oversleepFactor {
                logger.log(level: .debug, message: "AppHang: ignoring likely false positive, detector thread woke up late.", error: nil, data: nil)
                semaphore.wait()
                continue
            }

            let reported = onHangStarted(thresholdMs: thresholdMs)

            // No overall timeout, so the reported duration is the real one. The wait is sliced
            // only so the elapsed time can be written to disk while the thread is still blocked.
            var cancelled = false
            while semaphore.wait(timeout: .now() + .milliseconds(Int(AppHangConstants.heartbeatIntervalMs))) == .timedOut {
                if Thread.current.isCancelled {
                    // Teardown already discarded the record; reporting an outcome now would
                    // resurrect a hang that nobody is going to resolve.
                    cancelled = true
                    break
                }
                if reported {
                    callbacks?.onAppHangHeartbeat(elapsedMs: Number(elapsedMs(since: waitStart)))
                }
            }

            if cancelled { return }

            let durationMs = elapsedMs(since: waitStart)

            guard reported else { continue }

            if durationMs >= AppHangConstants.falsePositiveCeilingMs {
                let reason = "duration \(Int(durationMs))ms reached the \(Int(AppHangConstants.falsePositiveCeilingMs))ms ceiling"
                logger.log(level: .debug, message: "AppHang: discarding hang, \(reason).", error: nil, data: nil)
                callbacks?.onAppHangDiscarded(reason: reason)
                continue
            }

            onHangEnded(durationMs: durationMs)
        }
    }

    /// Returns `false` when the hang was not recorded, so the caller can skip the resolution half.
    private func onHangStarted(thresholdMs: Double) -> Bool {
        guard let callbacks else { return false }

        // Sampling is decided before the capture, so a hang that samples out costs nothing.
        guard callbacks.shouldReportAppHang() else {
            logger.log(level: .debug, message: "AppHang: hang detected but not sampled.", error: nil, data: nil)
            return false
        }

        // The timestamp is the moment the threshold was crossed, taken before the capture so the
        // cost of walking the stack does not push the event later than the hang it describes.
        let timestamp = timeProvider.now()
        let stack = stackCapture.capture()

        logger.log(level: .warning,
                   message: "AppHang: hang started, threshold \(Int(thresholdMs))ms, \(stack?.frames.count ?? 0) frames across \(stack?.binaryImages.count ?? 0) binary images.",
                   error: nil,
                   data: nil)

        callbacks.onAppHangStarted(stack: stack, thresholdMs: Number(thresholdMs), timestamp: timestamp)
        return true
    }

    private func onHangEnded(durationMs: Double) {
        logger.log(level: .warning, message: "AppHang: hang ended, duration \(Int(durationMs))ms.", error: nil, data: nil)
        callbacks?.onAppHangEnded(durationMs: Number(durationMs))
    }

    private func elapsedMs(since start: DispatchTime) -> Double {
        Double(DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
    }
}
