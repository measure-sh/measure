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

/// `MeasureSessionManager`  is responsible for creating and managing sessions within the Measure SDK.
///
/// - Note: This class assumes that `start()` is called before accessing `sessionId` to ensure a valid session ID is available.
/// 
class MeasureSessionManager: SessionManager {
    private let idProvider: IdProvider
    private let logger: Logger
    private var currentSessionId: String?
    private let timeProvider: TimeProvider
    private var appBackgroundTimeMs: Int64
    private let configProvider: ConfigProvider
    private let randomizer: Randomizer

    /// The current session ID.
    var sessionId: String {
        if let id = currentSessionId {
            return id
        } else {
            fatalError("Session ID is null. Ensure that start() is called before calling getSessionId()")
        }
    }

    init(idProvider: IdProvider,
         logger: Logger,
         timeProvider: TimeProvider,
         configProvider: ConfigProvider,
         randomizer: Randomizer = BaseRandomizer()) {
        self.appBackgroundTimeMs = 0
        self.idProvider = idProvider
        self.logger = logger
        self.timeProvider = timeProvider
        self.configProvider = configProvider
        self.randomizer = randomizer
    }

    private func createNewSession() {
        currentSessionId = idProvider.createId()
        logger.log(level: .debug, message: "New session created", error: nil)
    }

    func start() {
        createNewSession()
    }

    func applicationDidEnterBackground() {
        self.appBackgroundTimeMs = timeProvider.uptimeInMillis
        logger.log(level: .debug, message: "applicationDidEnterBackground", error: nil)
    }

    func applicationWillEnterForeground() {
        guard !(appBackgroundTimeMs == 0 || currentSessionId == nil) else {
            // if the app was never in background or a session was never created, return early.
            return
        }
        if shouldEndSession() {
            createNewSession()
        }
        logger.log(level: .debug, message: "applicationWillEnterForeground", error: nil)
    }

    func applicationWillTerminate() {
        logger.log(level: .debug, message: "applicationWillTerminate", error: nil)
    }

    private func shouldEndSession() -> Bool {
        let durationInBackground = timeProvider.uptimeInMillis - appBackgroundTimeMs

        if durationInBackground >= configProvider.sessionEndThresholdMs {
            logger.log(level: .debug, message: "Ending session as app was relaunched after being in background for \(durationInBackground) ms", error: nil)
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
