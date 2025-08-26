//
//  UserTriggeredEventCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 08/01/25.
//

import Foundation

protocol UserTriggeredEventCollector {
    func trackScreenView(_ screenName: String, attributes: [String: AttributeValue]?)
    func trackError(_ error: Error, attributes: [String: AttributeValue]?, collectStackTraces: Bool)
    func trackError(_ error: NSError, attributes: [String: AttributeValue]?, collectStackTraces: Bool)
    func enable()
    func disable()
}

final class BaseUserTriggeredEventCollector: UserTriggeredEventCollector {
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private var isEnabled = AtomicBool(false)
    private let logger: Logger
    private let exceptionGenerator: ExceptionGenerator

    init(signalProcessor: SignalProcessor, timeProvider: TimeProvider, logger: Logger, exceptionGenerator: ExceptionGenerator) {
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.logger = logger
        self.exceptionGenerator = exceptionGenerator
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

    func trackScreenView(_ screenName: String, attributes: [String: AttributeValue]?) {
        guard isEnabled.get() else { return }

        track(ScreenViewData(name: screenName), type: .screenView, userDefinedAttributes: EventSerializer.serializeUserDefinedAttribute(attributes))
    }

    func trackError(_ error: Error, attributes: [String: AttributeValue]?, collectStackTraces: Bool) {
        guard isEnabled.get() else { return }

        if let exception = exceptionGenerator.generate(error as NSError, collectStackTraces: collectStackTraces) {
            track(exception, type: .exception, userDefinedAttributes: EventSerializer.serializeUserDefinedAttribute(attributes))
        }
    }

    func trackError(_ error: NSError, attributes: [String: AttributeValue]?, collectStackTraces: Bool) {
        guard isEnabled.get() else { return }

        if let exception = exceptionGenerator.generate(error, collectStackTraces: collectStackTraces) {
            track(exception, type: .exception, userDefinedAttributes: EventSerializer.serializeUserDefinedAttribute(attributes))
        }
    }

    private func track(_ data: Codable, type: EventType, userDefinedAttributes: String? = nil) {
        signalProcessor.trackUserTriggered(data: data,
                                           timestamp: timeProvider.now(),
                                           type: type,
                                           attributes: nil,
                                           sessionId: nil,
                                           attachments: nil,
                                           userDefinedAttributes: userDefinedAttributes,
                                           threadName: nil)
    }
}
