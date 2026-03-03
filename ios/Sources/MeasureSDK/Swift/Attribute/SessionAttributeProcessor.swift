//
//  SessionAttributeProcessor.swift
//  Measure
//
//  Created by Adwin Ross on 02/03/26.
//

import Foundation

final class SessionAttributeProcessor: AttributeProcessor {
    private let sessionManager: SessionManager
    
    init(sessionManager: SessionManager) {
        self.sessionManager = sessionManager
    }

    func appendAttributes(_ attribute: Attributes) {
        attribute.sessionStartTime = sessionManager.getSessionStartTime()
    }
}
