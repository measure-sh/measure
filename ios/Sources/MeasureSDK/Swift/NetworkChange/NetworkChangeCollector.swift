//
//  NetworkChangeCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/12/24.
//

import Foundation

protocol NetworkChangeCollector {
    func enable()
}

final class BaseNetworkChangeCollector: NetworkChangeCollector {
    private let logger: Logger
    private let eventProcessor: EventProcessor
    private let timeProvider: TimeProvider
    private let networkChangeDetector: NetworkChangeDetector
    private let networkChangeCallback: NetworkChangeCallback

    init(logger: Logger, eventProcessor: EventProcessor, timeProvider: TimeProvider) {
        self.logger = logger
        self.eventProcessor = eventProcessor
        self.timeProvider = timeProvider
        self.networkChangeCallback = NetworkChangeCallback()
        self.networkChangeDetector = BaseNetworkChangeDetector(networkChangeCallback: self.networkChangeCallback)
        self.networkChangeCallback.onNetworkChangeCallback = onNetworkChangeCallback(_:)
    }

    func enable() {
        logger.internalLog(level: .debug, message: "GestureCollector enabled", error: nil, data: nil)
        networkChangeDetector.start()
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
