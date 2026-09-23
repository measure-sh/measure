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

    /// Reports hangs the previous process did not survive.
    ///
    /// Deferred until the dynamic config is available, because the timeline window and whether a
    /// replay is collected at all both come from it. At init those would still be SDK defaults.
    func onConfigLoaded()
}

/// Turns hangs reported by an `AppHangDetector` into `app_hang` events.
///
/// An app hang is written in two phases, because the process may not survive it. The moment the
/// threshold is crossed the event is stored with `state: killed` and the threshold as its
/// duration, marked `pendingResolution` so nothing can export it yet. While the hang continues its
/// payload is rewritten with the elapsed time, so a hang the process does not survive still
/// carries a real duration. If the main thread comes back, the row is rewritten once more with the
/// true duration and `state: recovered`, and only then becomes reportable.
///
/// A record still pending at the next launch means the process died while hung, and is reported
/// as a fatal hang once the config has loaded.
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

    private var isEnabled = AtomicBool(false)

    /// The hang currently awaiting an outcome. Only the detector thread touches these, and it
    /// handles one hang at a time: a new probe is only dispatched after the previous one resolved.
    private var pendingEventId: String?
    private var pendingEvent: AppHang?
    private var pendingTimestamp: Number?

    init(logger: Logger,
         detector: AppHangDetector,
         signalProcessor: SignalProcessor,
         signalSampler: SignalSampler,
         eventStore: EventStore,
         sessionStore: SessionStore,
         configProvider: ConfigProvider,
         crashDataPersistence: CrashDataPersistence,
         sysCtl: SysCtl) {
        self.logger = logger
        self.detector = detector
        self.signalProcessor = signalProcessor
        self.signalSampler = signalSampler
        self.eventStore = eventStore
        self.sessionStore = sessionStore
        self.configProvider = configProvider
        self.crashDataPersistence = crashDataPersistence
        self.sysCtl = sysCtl
        self.detector.callbacks = self
    }

    /// Builds the collector with the shipping detector, mirroring how `BaseNetworkChangeCollector`
    /// owns its own detector.
    convenience init(logger: Logger,
                     signalProcessor: SignalProcessor,
                     signalSampler: SignalSampler,
                     eventStore: EventStore,
                     sessionStore: SessionStore,
                     configProvider: ConfigProvider,
                     crashDataPersistence: CrashDataPersistence,
                     sysCtl: SysCtl,
                     timeProvider: TimeProvider) {
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
                  sysCtl: sysCtl)
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            detector.enable()
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            detector.disable()

            // Backgrounding is the usual reason we get here. A process suspended while a hang is
            // outstanding is indistinguishable from one that died hung, so the record is thrown
            // away rather than left for the next launch to report as fatal.
            discardPendingHang(reason: "detection was disabled before the hang resolved")
        }
    }

    // MARK: - AppHangCallbacks

    func shouldReportAppHang() -> Bool {
        signalSampler.shouldSampleAppHang()
    }

    func onAppHangStarted(stack: AppHangStack?, thresholdMs: Number, timestamp: Number) {
        let appHang = AppHang(exceptions: [makeDetail(stack: stack)],
                              duration: thresholdMs,
                              state: .killed,
                              framework: Framework.apple,
                              foreground: crashDataPersistence.isForeground,
                              binaryImages: stack?.binaryImages)

        // Stored synchronously: after this returns the process may die at any moment, and an event
        // that never reached disk is a hang nobody hears about.
        let eventId = signalProcessor.trackAppHang(appHang,
                                                   timestamp: timestamp,
                                                   attributes: crashDataPersistence.attribute,
                                                   sessionId: crashDataPersistence.sessionId)

        pendingEventId = eventId
        pendingEvent = appHang
        pendingTimestamp = timestamp
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

        eventStore.resolveAppHang(eventId: eventId, payload: payload, needsReporting: true)

        if configProvider.appHangReplayEnabled {
            eventStore.markTimelineForReporting(eventTimestampMillis: timestamp,
                                                durationSeconds: configProvider.appHangTimelineDurationSeconds,
                                                sessionId: crashDataPersistence.sessionId ?? "")
        }

        clearPendingHang()
        logger.log(level: .debug, message: "AppHang: recorded a recovered hang of \(durationMs)ms.", error: nil, data: nil)
    }

    func onAppHangDiscarded(reason: String) {
        discardPendingHang(reason: reason)
    }

    // MARK: - Helpers

    private func makeDetail(stack: AppHangStack?) -> AppHangDetail {
        AppHangDetail(threadName: "main",
                      threadSequence: 0,
                      osBuildNumber: sysCtl.getOsBuildNumber(),
                      frames: stack?.frames)
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
    }

    // MARK: - Previous launch

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

        eventStore.resolveAppHang(eventId: event.id, payload: payload, needsReporting: true)
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
