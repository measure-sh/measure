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
         sessionStore: SessionStore) {
        self.appBackgroundTimeMs = 0
        self.idProvider = idProvider
        self.logger = logger
        self.timeProvider = timeProvider
        self.configProvider = configProvider
        self.randomizer = randomizer
        self.sessionStore = sessionStore
    }

    private func createNewSession() {
        currentSessionId = idProvider.createId()
        logger.log(level: .info, message: "New session created", error: nil, data: nil)
        let session = SessionEntity(sessionId: sessionId,
                              pid: ProcessInfo.processInfo.processIdentifier,
                              createdAt: Number(Date().timeIntervalSince1970),
                              needsReporting: true,
                              crashed: false)
        sessionStore.insertSession(session)
    }

    func start() {
        createNewSession()
    }

    func applicationDidEnterBackground() {
        self.appBackgroundTimeMs = timeProvider.uptimeInMillis
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

    private func shouldEndSession() -> Bool {
        let durationInBackground = timeProvider.uptimeInMillis - appBackgroundTimeMs

        if durationInBackground >= configProvider.sessionEndThresholdMs {
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
