//
//  UserTriggeredEventCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 08/01/25.
//

import Foundation

protocol UserTriggeredEventCollector {
    func trackScreenView(_ screenName: String)
    func enable()
    func disable()
}

final class BaseUserTriggeredEventCollector: UserTriggeredEventCollector {
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private var isEnabled = AtomicBool(false)
    private let logger: Logger

    init(signalProcessor: SignalProcessor, timeProvider: TimeProvider, logger: Logger) {
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.logger = logger
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            logger.log(level: .info, message: "UserTriggeredEventCollector enabled.", error: nil, data: nil)
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            logger.log(level: .info, message: "UserTriggeredEventCollector disabled.", error: nil, data: nil)
        }
    }

    func trackScreenView(_ screenName: String) {
        guard isEnabled.get() else { return }

        let data = ScreenViewData(name: screenName)
        signalProcessor.trackUserTriggered(data: data,
                                           timestamp: timeProvider.now(),
                                           type: .screenView,
                                           attributes: nil,
                                           sessionId: nil,
                                           attachments: nil,
                                           userDefinedAttributes: nil,
                                           threadName: nil)
    }
}
