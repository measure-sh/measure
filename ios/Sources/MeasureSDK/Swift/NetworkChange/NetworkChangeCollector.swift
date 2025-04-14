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
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private let networkChangeDetector: NetworkChangeDetector
    private let networkChangeCallback: NetworkChangeCallback
    private var isEnabled = AtomicBool(false)

    init(logger: Logger, signalProcessor: SignalProcessor, timeProvider: TimeProvider) {
        self.logger = logger
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.networkChangeCallback = NetworkChangeCallback()
        self.networkChangeDetector = BaseNetworkChangeDetector(networkChangeCallback: self.networkChangeCallback)
        self.networkChangeCallback.onNetworkChangeCallback = onNetworkChangeCallback(_:)
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            networkChangeDetector.start()
            logger.log(level: .info, message: "NetworkChangeCollector enabled.", error: nil, data: nil)
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            networkChangeDetector.stop()
            logger.log(level: .info, message: "NetworkChangeCollector disabled.", error: nil, data: nil)
        }
    }

    func onNetworkChangeCallback(_ data: NetworkChangeData) {
        signalProcessor.track(data: data,
                              timestamp: timeProvider.now(),
                              type: .networkChange,
                              attributes: nil,
                              sessionId: nil,
                              attachments: nil,
                              userDefinedAttributes: nil,
                              threadName: nil)
    }
}
