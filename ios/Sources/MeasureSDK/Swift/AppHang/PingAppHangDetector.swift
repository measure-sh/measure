//
//  PingAppHangDetector.swift
//  Measure
//
//  Created by Adwin Ross on 21/09/26.
//

import Foundation

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

            if elapsedMs(since: waitStart) > thresholdMs * AppHangConstants.oversleepFactor {
                logger.log(level: .debug, message: "AppHang: ignoring likely false positive, detector thread woke up late.", error: nil, data: nil)
                semaphore.wait()
                continue
            }

            onHangStarted(thresholdMs: thresholdMs)

            var cancelled = false
            while semaphore.wait(timeout: .now() + .milliseconds(Int(AppHangConstants.heartbeatIntervalMs))) == .timedOut {
                if Thread.current.isCancelled {
                    cancelled = true
                    break
                }
                callbacks?.onAppHangHeartbeat(elapsedMs: Number(elapsedMs(since: waitStart)))
            }

            if cancelled { return }

            let durationMs = elapsedMs(since: waitStart)

            if durationMs >= AppHangConstants.falsePositiveCeilingMs {
                let reason = "duration \(Int(durationMs))ms reached the \(Int(AppHangConstants.falsePositiveCeilingMs))ms ceiling"
                logger.log(level: .debug, message: "AppHang: discarding hang, \(reason).", error: nil, data: nil)
                callbacks?.onAppHangDiscarded(reason: reason)
                continue
            }

            onHangEnded(durationMs: durationMs)
        }
    }

    private func onHangStarted(thresholdMs: Double) {
        guard let callbacks else { return }

        let timestamp = timeProvider.now()
        let stack = stackCapture.capture()

        logger.log(level: .warning,
                   message: "AppHang: hang started, threshold \(Int(thresholdMs))ms, \(stack?.frames.count ?? 0) frames across \(stack?.binaryImages.count ?? 0) binary images.",
                   error: nil,
                   data: nil)

        callbacks.onAppHangStarted(stack: stack, thresholdMs: Number(thresholdMs), timestamp: timestamp)
    }

    private func onHangEnded(durationMs: Double) {
        logger.log(level: .warning, message: "AppHang: hang ended, duration \(Int(durationMs))ms.", error: nil, data: nil)
        callbacks?.onAppHangEnded(durationMs: Number(durationMs))
    }

    private func elapsedMs(since start: DispatchTime) -> Double {
        Double(DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
    }
}
