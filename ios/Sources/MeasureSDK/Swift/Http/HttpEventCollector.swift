//
//  HttpEventCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 28/11/24.
//

import Foundation

protocol HttpEventCollector {
    func enable()
    func disable()
}

final class BaseHttpEventCollector: HttpEventCollector {
    private let logger: Logger
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private let urlSessionTaskSwizzler: URLSessionTaskSwizzler
    private let httpInterceptorCallbacks: HttpInterceptorCallbacks
    private let client: Client
    private let configProvider: ConfigProvider
    private let signalSampler: SignalSampler
    private let httpEventValidator: HttpEventValidator
    private var isEnabled = AtomicBool(false)

    init(logger: Logger,
         signalProcessor: SignalProcessor,
         timeProvider: TimeProvider,
         urlSessionTaskSwizzler: URLSessionTaskSwizzler,
         httpInterceptorCallbacks: HttpInterceptorCallbacks,
         client: Client,
         configProvider: ConfigProvider,
         signalSampler: SignalSampler,
         httpEventValidator: HttpEventValidator) {
        self.logger = logger
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.urlSessionTaskSwizzler = urlSessionTaskSwizzler
        self.httpInterceptorCallbacks = httpInterceptorCallbacks
        self.client = client
        self.configProvider = configProvider
        self.signalSampler = signalSampler
        self.httpEventValidator = httpEventValidator
        self.httpInterceptorCallbacks.httpDataCallback = onHttpCompletion(data:)
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            NetworkInterceptorProtocol.setTimeProvider(timeProvider)
            NetworkInterceptorProtocol.setHttpInterceptorCallbacks(httpInterceptorCallbacks)
            NetworkInterceptorProtocol.setConfigProvider(configProvider)
            urlSessionTaskSwizzler.swizzleURLSessionTask()
            URLSessionTaskInterceptor.shared.setHttpInterceptorCallbacks(httpInterceptorCallbacks)
            URLSessionTaskInterceptor.shared.setTimeProvider(timeProvider)
            URLSessionTaskInterceptor.shared.setConfigProvider(configProvider)
            URLSessionTaskInterceptor.shared.setSignalSampler(signalSampler)
            logger.log(level: .info, message: "HttpEventCollector enabled.", error: nil, data: nil)
        }
    }

    func disable() {
        isEnabled.setFalseIfTrue {
            logger.log(level: .info, message: "HttpEventCollector disabled.", error: nil, data: nil)
        }
    }

    func onHttpCompletion(data: HttpData) {
        if isEnabled.get() {
            signalProcessor.track(data: data,
                                  timestamp: timeProvider.now(),
                                  type: .http,
                                  attributes: nil,
                                  sessionId: nil,
                                  attachments: nil,
                                  userDefinedAttributes: nil,
                                  threadName: nil,
                                  needsReporting: false)
        }
    }
}
