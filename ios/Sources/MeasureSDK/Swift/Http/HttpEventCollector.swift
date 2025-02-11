//
//  HttpEventCollector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 28/11/24.
//

import Foundation

protocol HttpEventCollector {
    func enable()
}

final class BaseHttpEventCollector: HttpEventCollector {
    private let logger: Logger
    private let eventProcessor: EventProcessor
    private let timeProvider: TimeProvider
    private let urlSessionTaskSwizzler: URLSessionTaskSwizzler
    private let httpInterceptorCallbacks: HttpInterceptorCallbacks
    private let client: Client
    private let configProvider: ConfigProvider

    init(logger: Logger,
         eventProcessor: EventProcessor,
         timeProvider: TimeProvider,
         urlSessionTaskSwizzler: URLSessionTaskSwizzler,
         httpInterceptorCallbacks: HttpInterceptorCallbacks,
         client: Client,
         configProvider: ConfigProvider) {
        self.logger = logger
        self.eventProcessor = eventProcessor
        self.timeProvider = timeProvider
        self.urlSessionTaskSwizzler = urlSessionTaskSwizzler
        self.httpInterceptorCallbacks = httpInterceptorCallbacks
        self.client = client
        self.configProvider = configProvider
        self.httpInterceptorCallbacks.httpDataCallback = onHttpCompletion(data:)
    }

    func enable() {
        NetworkInterceptorProtocol.setTimeProvider(timeProvider)
        NetworkInterceptorProtocol.setHttpInterceptorCallbacks(httpInterceptorCallbacks)
        NetworkInterceptorProtocol.setHttpContentTypeAllowlist(configProvider.httpContentTypeAllowlist)
        NetworkInterceptorProtocol.setDefaultHttpHeadersBlocklist(configProvider.defaultHttpHeadersBlocklist)
        urlSessionTaskSwizzler.swizzleURLSessionTask()
        URLSessionTaskInterceptor.shared.setHttpInterceptorCallbacks(httpInterceptorCallbacks)
        URLSessionTaskInterceptor.shared.setTimeProvider(timeProvider)
        URLSessionTaskInterceptor.shared.setHttpContentTypeAllowlist(configProvider.httpContentTypeAllowlist)
        URLSessionTaskInterceptor.shared.setDefaultHttpHeadersBlocklist(configProvider.defaultHttpHeadersBlocklist)
    }

    func onHttpCompletion(data: HttpData) {
        eventProcessor.track(data: data,
                             timestamp: timeProvider.now(),
                             type: .http,
                             attributes: nil,
                             sessionId: nil,
                             attachments: nil,
                             userDefinedAttributes: nil)
    }
}
