//
//  NetworkChangeCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/12/24.
//

import Foundation

protocol NetworkChangeCollector {
    func enable()
    func disable()
}

final class BaseNetworkChangeCollector: NetworkChangeCollector {
    private let logger: Logger
    private let eventProcessor: EventProcessor
    private let timeProvider: TimeProvider
    private let networkChangeDetector: NetworkChangeDetector
    private let networkChangeCallback: NetworkChangeCallback
    private var isEnabled = false

    init(logger: Logger, eventProcessor: EventProcessor, timeProvider: TimeProvider) {
        self.logger = logger
        self.eventProcessor = eventProcessor
        self.timeProvider = timeProvider
        self.networkChangeCallback = NetworkChangeCallback()
        self.networkChangeDetector = BaseNetworkChangeDetector(networkChangeCallback: self.networkChangeCallback)
        self.networkChangeCallback.onNetworkChangeCallback = onNetworkChangeCallback(_:)
    }

    func enable() {
        networkChangeDetector.start()
        isEnabled = true
        logger.log(level: .info, message: "NetworkChangeCollector enabled.", error: nil, data: nil)
    }

    func disable() {
        networkChangeDetector.stop()
        isEnabled = false
        logger.log(level: .info, message: "NetworkChangeCollector disabled.", error: nil, data: nil)
    }

    func onNetworkChangeCallback(_ data: NetworkChangeData) {
        eventProcessor.track(data: data,
                             timestamp: timeProvider.now(),
                             type: .networkChange,
                             attributes: nil,
                             sessionId: nil,
                             attachments: nil,
                             userDefinedAttributes: nil)
    }
}
