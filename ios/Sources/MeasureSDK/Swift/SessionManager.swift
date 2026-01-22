//
//  SessionManager.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 29/08/24.
//

import Foundation

/// Protocol defining the requirements for initializing the SessionManager.
protocol SessionManager {
    var sessionId: String { get }
    var shouldReportJourneyEvents: Bool { get }
    func start(onNewSession: (String?) -> Void)
    func applicationDidEnterBackground()
    func applicationWillEnterForeground()
    func applicationWillTerminate()
    func onEventTracked<T: Codable>(_ event: Event<T>)
    func setPreviousSessionCrashed(_ crashed: Bool)
    func markCurrentSessionAsCrashed()
    func onConfigLoaded()
}

/// `BaseSessionManager`  is responsible for creating and managing sessions within the Measure SDK.
///
/// - Note: This class assumes that `start()` is called before accessing `sessionId` to ensure a valid session ID is available.
/// 
final class BaseSessionManager: SessionManager {
    private let idProvider: IdProvider
    private let logger: Logger
    private var currentSessionId: String?
    private let timeProvider: TimeProvider
    private var appBackgroundTimeMs: Number
    private let configProvider: ConfigProvider
    private let sessionStore: SessionStore
    private let eventStore: EventStore
    private let userDefaultStorage: UserDefaultStorage
    private var previousSessionCrashed = false
    private let versionCode: String
    private let signalSampler: SignalSampler
    var shouldReportJourneyEvents: Bool

    /// The current session ID.
    var sessionId: String {
        if let id = currentSessionId {
            return id
        } else {
            logger.log(level: .fatal, message: "Session ID is null. Ensure that start() is called before accessing sessionId.", error: nil, data: nil)
            return ""
        }
    }

    init(idProvider: IdProvider,
         logger: Logger,
         timeProvider: TimeProvider,
         configProvider: ConfigProvider,
         sessionStore: SessionStore,
         eventStore: EventStore,
         userDefaultStorage: UserDefaultStorage,
         versionCode: String,
         signalSampler: SignalSampler) {
        self.appBackgroundTimeMs = 0
        self.idProvider = idProvider
        self.logger = logger
        self.timeProvider = timeProvider
        self.configProvider = configProvider
        self.sessionStore = sessionStore
        self.eventStore = eventStore
        self.userDefaultStorage = userDefaultStorage
        self.versionCode = versionCode
        self.shouldReportJourneyEvents = false
        self.signalSampler = signalSampler
    }

    private func createNewSession() {
        currentSessionId = idProvider.uuid()
        logger.log(level: .info, message: "New session created: \(currentSessionId ?? "nil")", error: nil, data: nil)
        let session = SessionEntity(sessionId: sessionId,
                                    pid: ProcessInfo.processInfo.processIdentifier,
                                    createdAt: Number(timeProvider.now()),
                                    needsReporting: false,
                                    crashed: false)
        sessionStore.insertSession(session) {}
        let recentSession = RecentSession(id: session.sessionId,
                                          createdAt: session.createdAt,
                                          versionCode: versionCode)
        userDefaultStorage.setRecentSession(recentSession)
    }

    func start(onNewSession: (String?) -> Void) {
        createNewSession()
        onNewSession(currentSessionId)
    }

    func applicationDidEnterBackground() {
        self.appBackgroundTimeMs = timeProvider.millisTime
        logger.log(level: .info, message: "applicationDidEnterBackground", error: nil, data: nil)
    }

    func applicationWillEnterForeground() {
        guard !(appBackgroundTimeMs == 0 || currentSessionId == nil) else {
            // if the app was never in background or a session was never created, return early.
            return
        }
        if shouldEndSession() {
            createNewSession()
        }
        logger.log(level: .info, message: "applicationWillEnterForeground", error: nil, data: nil)
    }

    func applicationWillTerminate() {
        logger.log(level: .info, message: "applicationWillTerminate", error: nil, data: nil)
    }

    func onEventTracked<T: Codable>(_ event: Event<T>) {
        userDefaultStorage.setRecentSessionEventTime(event.timestampInMillis)
    }

    func setPreviousSessionCrashed(_ crashed: Bool) {
        self.previousSessionCrashed = crashed
        if let recentSession = userDefaultStorage.getRecentSession(), previousSessionCrashed {
            sessionStore.markCrashedSession(sessionId: recentSession.id) {}
            sessionStore.updateNeedsReporting(sessionId: recentSession.id, needsReporting: true)
        }
    }

    func markCurrentSessionAsCrashed() {
        sessionStore.markCrashedSession(sessionId: sessionId) {}

        sessionStore.getSession(byId: sessionId) { [weak self] session in
            guard let self, let session else { return }

            let recentSession = RecentSession(
                id: session.sessionId,
                createdAt: session.createdAt,
                crashed: true,
                versionCode: versionCode
            )

            self.userDefaultStorage.setRecentSession(recentSession)
            self.sessionStore.updateNeedsReporting(sessionId: self.sessionId, needsReporting: true)
        }
    }

    func onConfigLoaded() {
        guard let sessionId = currentSessionId else {
            return
        }

        let shouldReport = signalSampler.shouldTrackJourneyForSession(sessionId: sessionId)

        guard shouldReport else {
            return
        }

        logger.log(level: .debug, message: "SessionManager: Marking journey events session \(sessionId) for export after config load", error: nil, data: nil)

        eventStore.updateNeedsReportingForJourneyEvents(sessionId: sessionId, needsReporting: true)

        self.shouldReportJourneyEvents = true
    }

    private func shouldEndSession() -> Bool {
        let durationInBackground = timeProvider.millisTime - appBackgroundTimeMs

        if durationInBackground >= configProvider.sessionBackgroundTimeoutThresholdMs {
            logger.log(level: .info, message: "Ending session as app was relaunched after being in background for \(durationInBackground) ms", error: nil, data: nil)
            return true
        }

        return false
    }
}
