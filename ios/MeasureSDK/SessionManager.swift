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
    func start()
    func applicationDidEnterBackground()
    func applicationWillEnterForeground()
    func applicationWillTerminate()
    func onEventTracked(_ event: EventEntity)
    func setPreviousSessionCrashed(_ crashed: Bool)
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
    private let randomizer: Randomizer
    private let sessionStore: SessionStore
    private let userDefaultStorage: UserDefaultStorage
    private var previousSessionCrashed = false

    /// The current session ID.
    var sessionId: String {
        if let id = currentSessionId {
            return id
        } else {
            fatalError("Session ID is null. Ensure that start() is called before acessing sessionId.")
        }
    }

    init(idProvider: IdProvider,
         logger: Logger,
         timeProvider: TimeProvider,
         configProvider: ConfigProvider,
         randomizer: Randomizer = BaseRandomizer(),
         sessionStore: SessionStore,
         userDefaultStorage: UserDefaultStorage) {
        self.appBackgroundTimeMs = 0
        self.idProvider = idProvider
        self.logger = logger
        self.timeProvider = timeProvider
        self.configProvider = configProvider
        self.randomizer = randomizer
        self.sessionStore = sessionStore
        self.userDefaultStorage = userDefaultStorage
    }

    private func createNewSession() {
        currentSessionId = idProvider.createId()
        logger.log(level: .info, message: "New session created", error: nil, data: nil)
        let session = SessionEntity(sessionId: sessionId,
                                    pid: ProcessInfo.processInfo.processIdentifier,
                                    createdAt: Number(timeProvider.now()),
                                    needsReporting: true,
                                    crashed: false)
        sessionStore.insertSession(session)
        let recentSession = RecentSession(id: session.sessionId,
                                          createdAt: session.createdAt)
        userDefaultStorage.setRecentSession(recentSession)
    }

    private func getRecentSessionId() -> String? {
        if previousSessionCrashed {
            return nil
        }

        if let recentSession = userDefaultStorage.getRecentSession(), recentSession.lastEventTime != 0 {
            let elapsedTime = timeProvider.now() - recentSession.lastEventTime
            if elapsedTime <= configProvider.sessionEndLastEventThresholdMs {
                return recentSession.id
            }
        }
        return nil
    }

    private func isSessonDurationThreadholdReached() -> Bool {
        guard let recentSession = userDefaultStorage.getRecentSession() else {
            return false
        }

        // Check negative time to handle clock skew
        guard (timeProvider.now() - recentSession.createdAt) > 0 else {
            return false
        }

        return (timeProvider.now() - recentSession.createdAt) >= configProvider.maxSessionDurationMs
    }

    func start() {
        if isSessonDurationThreadholdReached() {
            logger.log(level: .info, message: "Ending previous session as maxSessionDurationMs threshold is reached.", error: nil, data: nil)
            createNewSession()
        } else if let recentSessionId = getRecentSessionId() {
            logger.log(level: .info, message: "Continuing previous session \(recentSessionId)", error: nil, data: nil)
            currentSessionId = recentSessionId
        } else {
            createNewSession()
        }
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
        if shouldEndSession() || isSessonDurationThreadholdReached() {
            createNewSession()
        }
        logger.log(level: .info, message: "applicationWillEnterForeground", error: nil, data: nil)
    }

    func applicationWillTerminate() {
        logger.log(level: .info, message: "applicationWillTerminate", error: nil, data: nil)
    }

    func onEventTracked(_ event: EventEntity) {
        userDefaultStorage.setRecentSessionEventTime(event.timestampInMillis)
    }

    func setPreviousSessionCrashed(_ crashed: Bool) {
        self.previousSessionCrashed = crashed
    }

    private func shouldEndSession() -> Bool {
        let durationInBackground = timeProvider.millisTime - appBackgroundTimeMs

        if durationInBackground >= configProvider.sessionEndLastEventThresholdMs {
            logger.log(level: .info, message: "Ending session as app was relaunched after being in background for \(durationInBackground) ms", error: nil, data: nil)
            return true
        }

        return false
    }

    private func shouldMarkSessionForExport() -> Bool {
        if configProvider.sessionSamplingRate == 0.0 {
            return false
        }
        if configProvider.sessionSamplingRate == 1.0 {
            return true
        }
        return randomizer.random() < configProvider.sessionSamplingRate
    }
}
