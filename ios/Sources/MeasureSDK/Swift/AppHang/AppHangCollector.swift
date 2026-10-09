//
//  AppHangCollector.swift
//  Measure
//
//  Created by Adwin Ross on 21/09/26.
//

import Foundation

protocol AppHangCollector {
    func enable()
    func disable()

    func onConfigLoaded()
}

final class BaseAppHangCollector: AppHangCollector, AppHangCallbacks {
    private let logger: Logger
    private let detector: AppHangDetector
    private let signalProcessor: SignalProcessor
    private let signalSampler: SignalSampler
    private let eventStore: EventStore
    private let sessionStore: SessionStore
    private let configProvider: ConfigProvider
    private let crashDataPersistence: CrashDataPersistence
    private let sysCtl: SysCtl
    private let exporter: Exporter

    private var isEnabled = AtomicBool(false)

    private var pendingEventId: String?
    private var pendingEvent: AppHang?
    private var pendingTimestamp: Number?
    private var pendingNeedsReporting = false

    init(logger: Logger,
         detector: AppHangDetector,
         signalProcessor: SignalProcessor,
         signalSampler: SignalSampler,
         eventStore: EventStore,
         sessionStore: SessionStore,
         configProvider: ConfigProvider,
         crashDataPersistence: CrashDataPersistence,
         sysCtl: SysCtl,
         exporter: Exporter) {
        self.logger = logger
        self.detector = detector
        self.signalProcessor = signalProcessor
        self.signalSampler = signalSampler
        self.eventStore = eventStore
        self.sessionStore = sessionStore
        self.configProvider = configProvider
        self.crashDataPersistence = crashDataPersistence
        self.sysCtl = sysCtl
        self.exporter = exporter
        self.detector.callbacks = self
    }

    convenience init(logger: Logger,
                     signalProcessor: SignalProcessor,
                     signalSampler: SignalSampler,
                     eventStore: EventStore,
                     sessionStore: SessionStore,
                     configProvider: ConfigProvider,
                     crashDataPersistence: CrashDataPersistence,
                     sysCtl: SysCtl,
                     timeProvider: TimeProvider,
                     exporter: Exporter) {
        self.init(logger: logger,
                  detector: PingAppHangDetector(logger: logger,
                                                configProvider: configProvider,
                                                stackCapture: BaseAppHangStackCapture(logger: logger),
                                                timeProvider: timeProvider),
                  signalProcessor: signalProcessor,
                  signalSampler: signalSampler,
                  eventStore: eventStore,
                  sessionStore: sessionStore,
                  configProvider: configProvider,
                  crashDataPersistence: crashDataPersistence,
                  sysCtl: sysCtl,
                  exporter: exporter)
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            detector.enable()
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            detector.disable()

            discardPendingHang(reason: "detection was disabled before the hang resolved")
        }
    }

    func onAppHangStarted(stack: AppHangStack?, thresholdMs: Number, timestamp: Number) {
        guard let stack, !stack.frames.isEmpty else {
            logger.log(level: .debug,
                       message: "AppHang: discarding a hang, the stack capture returned no frames.",
                       error: nil,
                       data: nil)
            return
        }

        let appHang = AppHang(exceptions: [makeDetail(stack: stack)],
                              duration: thresholdMs,
                              state: .killed,
                              framework: Framework.apple,
                              foreground: crashDataPersistence.isForeground,
                              binaryImages: stack.binaryImages)

        let needsReporting = signalSampler.shouldSampleAppHang()

        let eventId = signalProcessor.trackAppHang(appHang,
                                                   timestamp: timestamp,
                                                   attributes: crashDataPersistence.attribute,
                                                   sessionId: crashDataPersistence.sessionId,
                                                   needsReporting: needsReporting)

        pendingEventId = eventId
        pendingEvent = appHang
        pendingTimestamp = timestamp
        pendingNeedsReporting = needsReporting
    }

    func onAppHangHeartbeat(elapsedMs: Number) {
        guard let eventId = pendingEventId, var appHang = pendingEvent else { return }

        appHang.duration = elapsedMs
        pendingEvent = appHang

        guard let payload = encode(appHang) else { return }

        eventStore.updateAppHangPayload(eventId: eventId, payload: payload)
    }

    func onAppHangEnded(durationMs: Number) {
        guard let eventId = pendingEventId, var appHang = pendingEvent, let timestamp = pendingTimestamp else {
            return
        }

        appHang.duration = durationMs
        appHang.state = .recovered

        guard let payload = encode(appHang) else {
            discardPendingHang(reason: "the resolved payload could not be encoded")
            return
        }

        eventStore.resolveAppHang(eventId: eventId, payload: payload)

        // A hang that is not being reported must not drag a replay window into an export with it.
        if pendingNeedsReporting && configProvider.appHangReplayEnabled {
            eventStore.markTimelineForReporting(eventTimestampMillis: timestamp,
                                                durationSeconds: configProvider.appHangTimelineDurationSeconds,
                                                sessionId: crashDataPersistence.sessionId ?? "")
        }

        let needsExport = pendingNeedsReporting

        clearPendingHang()
        logger.log(level: .debug, message: "AppHang: recorded a recovered hang of \(durationMs)ms.", error: nil, data: nil)

        if needsExport {
            exporter.export()
        }
    }

    func onAppHangDiscarded(reason: String) {
        discardPendingHang(reason: reason)
    }

    private func makeDetail(stack: AppHangStack) -> AppHangDetail {
        AppHangDetail(threadName: "main",
                      threadSequence: 0,
                      osBuildNumber: sysCtl.getOsBuildNumber(),
                      frames: stack.frames)
    }

    private func discardPendingHang(reason: String) {
        guard let eventId = pendingEventId else { return }

        eventStore.deleteEvents(eventIds: [eventId])
        clearPendingHang()
        logger.log(level: .debug, message: "AppHang: discarded an unresolved hang, \(reason).", error: nil, data: nil)
    }

    private func clearPendingHang() {
        pendingEventId = nil
        pendingEvent = nil
        pendingTimestamp = nil
        pendingNeedsReporting = false
    }

    func onConfigLoaded() {
        let currentSessionId = crashDataPersistence.sessionId
        let unresolved = eventStore.getUnresolvedAppHangs()
            .filter { $0.sessionId != currentSessionId && $0.id != pendingEventId }

        for event in unresolved {
            resolve(event)
        }
    }

    private func resolve(_ event: EventEntity) {
        guard let payload = event.appHang,
              let appHang = try? JSONDecoder().decode(AppHang.self, from: payload) else {
            eventStore.deleteEvents(eventIds: [event.id])
            return
        }

        guard Double(appHang.duration) < AppHangConstants.falsePositiveCeilingMs else {
            eventStore.deleteEvents(eventIds: [event.id])
            logger.log(level: .debug,
                       message: "AppHang: discarding a fatal hang of \(appHang.duration)ms, at or above the ceiling.",
                       error: nil,
                       data: nil)
            return
        }

        eventStore.resolveAppHang(eventId: event.id, payload: payload)

        guard event.needsReporting else {
            logger.log(level: .debug, message: "AppHang: a fatal hang from a previous launch was sampled out.", error: nil, data: nil)
            return
        }

        sessionStore.updateNeedsReporting(sessionId: event.sessionId, needsReporting: true)

        if configProvider.appHangReplayEnabled {
            eventStore.markTimelineForReporting(eventTimestampMillis: event.timestampInMillis,
                                                durationSeconds: configProvider.appHangTimelineDurationSeconds,
                                                sessionId: event.sessionId)
        }

        logger.log(level: .warning, message: "AppHang: reported a fatal hang of \(appHang.duration)ms from a previous launch.", error: nil, data: nil)
    }

    private func encode(_ appHang: AppHang) -> Data? {
        do {
            return try JSONEncoder().encode(appHang)
        } catch {
            logger.internalLog(level: .error, message: "AppHang: failed to encode the resolved payload.", error: error, data: nil)
            return nil
        }
    }
}
