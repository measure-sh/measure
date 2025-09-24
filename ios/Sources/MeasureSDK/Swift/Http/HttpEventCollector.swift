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
    private let httpEventValidator: HttpEventValidator
    private var isEnabled = AtomicBool(false)

    init(logger: Logger,
         signalProcessor: SignalProcessor,
         timeProvider: TimeProvider,
         urlSessionTaskSwizzler: URLSessionTaskSwizzler,
         httpInterceptorCallbacks: HttpInterceptorCallbacks,
         client: Client,
         configProvider: ConfigProvider,
         httpEventValidator: HttpEventValidator) {
        self.logger = logger
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.urlSessionTaskSwizzler = urlSessionTaskSwizzler
        self.httpInterceptorCallbacks = httpInterceptorCallbacks
        self.client = client
        self.configProvider = configProvider
        self.httpEventValidator = httpEventValidator
        self.httpInterceptorCallbacks.httpDataCallback = onHttpCompletion(data:)
    }

    func enable() {
        isEnabled.setTrueIfFalse {
            NetworkInterceptorProtocol.setTimeProvider(timeProvider)
            NetworkInterceptorProtocol.setHttpInterceptorCallbacks(httpInterceptorCallbacks)
            NetworkInterceptorProtocol.setHttpContentTypeAllowlist(configProvider.httpContentTypeAllowlist)
            NetworkInterceptorProtocol.setDefaultHttpHeadersBlocklist(configProvider.defaultHttpHeadersBlocklist + configProvider.httpHeadersBlocklist)
            NetworkInterceptorProtocol.setAllowedDomains(configProvider.httpUrlAllowlist)
            NetworkInterceptorProtocol.setIgnoredDomains(configProvider.httpUrlBlocklist + [client.apiUrl.absoluteString])
            NetworkInterceptorProtocol.setConfigProvider(configProvider)
            NetworkInterceptorProtocol.setHttpEventValidator(httpEventValidator)
            urlSessionTaskSwizzler.swizzleURLSessionTask()
            URLSessionTaskInterceptor.shared.setHttpInterceptorCallbacks(httpInterceptorCallbacks)
            URLSessionTaskInterceptor.shared.setTimeProvider(timeProvider)
            URLSessionTaskInterceptor.shared.setHttpContentTypeAllowlist(configProvider.httpContentTypeAllowlist)
            URLSessionTaskInterceptor.shared.setDefaultHttpHeadersBlocklist(configProvider.defaultHttpHeadersBlocklist + configProvider.httpHeadersBlocklist)
            URLSessionTaskInterceptor.shared.setAllowedDomains(configProvider.httpUrlAllowlist)
            URLSessionTaskInterceptor.shared.setIgnoredDomains(configProvider.httpUrlBlocklist + [client.apiUrl.absoluteString])
            URLSessionTaskInterceptor.shared.setConfigProvider(configProvider)
            URLSessionTaskInterceptor.shared.setHttpEventValidator(httpEventValidator)
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
                                  threadName: nil)
        }
    }
}
