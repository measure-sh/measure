//
//  SessionAttributeProcessor.swift
//  Measure
//
//  Created by Adwin Ross on 02/03/26.
//

import Foundation

final class SessionAttributeProcessor: AttributeProcessor {
    private let sessionManager: SessionManager
    private let timeProvider: TimeProvider
    
    init(sessionManager: SessionManager, timeProvider: TimeProvider) {
        self.sessionManager = sessionManager
        self.timeProvider = timeProvider
    }

    func appendAttributes(_ attribute: Attributes) {
        if let sessionStartTime = sessionManager.getSessionStartTime() {
            attribute.sessionStartTime = timeProvider.iso8601Timestamp(timeInMillis: sessionStartTime)
        }
    }
}
