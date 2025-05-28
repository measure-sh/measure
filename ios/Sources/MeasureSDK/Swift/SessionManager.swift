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
    var shouldReportSession: Bool { get }
    func start()
    func applicationDidEnterBackground()
    func applicationWillEnterForeground()
    func applicationWillTerminate()
    func onEventTracked(_ event: EventEntity)
    func setPreviousSessionCrashed(_ crashed: Bool)
    func markCurrentSessionAsCrashed()
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
    private let eventStore: EventStore
    private let userDefaultStorage: UserDefaultStorage
    private var previousSessionCrashed = false
    private let versionCode: String
    private let appVersionInfo: AppVersionInfo
    var shouldReportSession: Bool

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
         randomizer: Randomizer = BaseRandomizer(),
         sessionStore: SessionStore,
         eventStore: EventStore,
         userDefaultStorage: UserDefaultStorage,
         versionCode: String,
         appVersionInfo: AppVersionInfo) {
        self.appBackgroundTimeMs = 0
        self.idProvider = idProvider
        self.logger = logger
        self.timeProvider = timeProvider
        self.configProvider = configProvider
        self.randomizer = randomizer
        self.sessionStore = sessionStore
        self.eventStore = eventStore
        self.userDefaultStorage = userDefaultStorage
        self.versionCode = versionCode
        self.shouldReportSession = false
        self.appVersionInfo = appVersionInfo
    }

    private func createNewSession() {
        currentSessionId = idProvider.uuid()
        logger.log(level: .info, message: "New session created: \(currentSessionId ?? "nil")", error: nil, data: nil)
        shouldReportSession = shouldMarkSessionForExport()
        let session = SessionEntity(sessionId: sessionId,
                                    pid: ProcessInfo.processInfo.processIdentifier,
                                    createdAt: Number(timeProvider.now()),
                                    needsReporting: shouldReportSession,
                                    crashed: false)
        sessionStore.insertSession(session)
        let recentSession = RecentSession(id: session.sessionId,
                                          createdAt: session.createdAt,
                                          versionCode: versionCode)
        userDefaultStorage.setRecentSession(recentSession)
    }

    private func getRecentSessionId() -> String? {
        if previousSessionCrashed {
            return nil
        }

        if let recentSession = userDefaultStorage.getRecentSession(), recentSession.lastEventTime != 0 {
            let elapsedTime = timeProvider.now() - recentSession.lastEventTime
            if elapsedTime <= configProvider.sessionEndLastEventThresholdMs && !recentSession.crashed {
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

    private func isFrameworkVersionUpdated() -> Bool {
        if let recentSession = userDefaultStorage.getRecentSession(),
           recentSession.versionCode == self.versionCode {
            return false
        }
        return true
    }

    func isAppVersionUpdated() -> Bool {
        let currentVersion = appVersionInfo.getAppVersion()
        let storedVersion = userDefaultStorage.getRecentAppVersion()

        if currentVersion != storedVersion {
            // update app version and build number if app version has changed
            updateAppVersionAndBuildNumber()
            return true
        }
        return false
    }

    func isAppBuildNumberUpdated() -> Bool {
        let currentBuild = appVersionInfo.getBuildNumber()
        let storedBuild = userDefaultStorage.getRecentBuildNumber()

        if currentBuild != storedBuild {
            // update app version and build number if build number has changed
            updateAppVersionAndBuildNumber()
            return true
        }
        return false
    }

    func updateAppVersionAndBuildNumber() {
        if let currentVersion = appVersionInfo.getAppVersion() {
            userDefaultStorage.setRecentAppVersion(currentVersion)
        }

        if let currentBuild = appVersionInfo.getBuildNumber() {
            userDefaultStorage.setRecentBuildNumber(currentBuild)
        }
    }

    func start() {
        if isAppVersionUpdated() || isAppBuildNumberUpdated() {
            logger.log(level: .info, message: "Ending previous session as app version or build number has been updated.", error: nil, data: nil)
            createNewSession()
        } else if isFrameworkVersionUpdated() {
            logger.log(level: .info, message: "Ending previous session as SDK version has been updated.", error: nil, data: nil)
            createNewSession()
        } else if isSessonDurationThreadholdReached() {
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
        if let recentSession = userDefaultStorage.getRecentSession(), previousSessionCrashed {
            sessionStore.markCrashedSession(sessionId: recentSession.id)
            sessionStore.updateNeedsReporting(sessionId: recentSession.id, needsReporting: true)
            eventStore.updateNeedsReportingForAllEvents(sessionId: recentSession.id, needsReporting: true)
        }
    }

    func markCurrentSessionAsCrashed() {
        sessionStore.markCrashedSession(sessionId: sessionId)
        if let session = sessionStore.getSession(byId: sessionId) {
            let recentSession = RecentSession(id: session.sessionId,
                                              createdAt: session.createdAt,
                                              crashed: true,
                                              versionCode: versionCode)
            userDefaultStorage.setRecentSession(recentSession)
        }
        if !shouldReportSession {
            sessionStore.updateNeedsReporting(sessionId: sessionId, needsReporting: true)
            eventStore.updateNeedsReportingForAllEvents(sessionId: sessionId, needsReporting: true)
            shouldReportSession = true
        }
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
        if configProvider.samplingRateForErrorFreeSessions == 0.0 {
            return false
        }
        if configProvider.samplingRateForErrorFreeSessions == 1.0 {
            return true
        }
        return randomizer.random() < configProvider.samplingRateForErrorFreeSessions
    }
}
