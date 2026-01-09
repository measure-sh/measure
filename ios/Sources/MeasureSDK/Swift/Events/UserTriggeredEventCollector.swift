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
    func trackHttpEvent(url: String,
                        method: String,
                        startTime: UInt64,
                        endTime: UInt64,
                        client: String,
                        statusCode: Int?,
                        error: Error?,
                        requestHeaders: [String: String]?,
                        responseHeaders: [String: String]?,
                        requestBody: String?,
                        responseBody: String?)
    func enable()
    func disable()
}

final class BaseUserTriggeredEventCollector: UserTriggeredEventCollector {
    private let signalProcessor: SignalProcessor
    private let timeProvider: TimeProvider
    private var isEnabled = AtomicBool(false)
    private let logger: Logger
    private let exceptionGenerator: ExceptionGenerator
    private let attributeValueValidator: AttributeValueValidator
    private let configProvider: ConfigProvider

    init(signalProcessor: SignalProcessor, timeProvider: TimeProvider, logger: Logger, exceptionGenerator: ExceptionGenerator, attributeValueValidator: AttributeValueValidator, configProvider: ConfigProvider) {
        self.signalProcessor = signalProcessor
        self.timeProvider = timeProvider
        self.logger = logger
        self.exceptionGenerator = exceptionGenerator
        self.attributeValueValidator = attributeValueValidator
        self.configProvider = configProvider
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
        guard attributeValueValidator.validateAttributes(name: screenName, attributes: attributes) else { return }

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

    func trackHttpEvent(url: String,
                        method: String,
                        startTime: UInt64,
                        endTime: UInt64,
                        client: String,
                        statusCode: Int?,
                        error: Error?,
                        requestHeaders: [String: String]?,
                        responseHeaders: [String: String]?,
                        requestBody: String?,
                        responseBody: String?) {
        guard isEnabled.get() else { return }

        if url.isEmpty {
            logger.log(level: .error, message: "Failed to track HTTP event, url is required", error: nil, data: nil)
            return
        }

        let validMethods = ["get", "post", "put", "delete", "patch"]
        if !validMethods.contains(method.lowercased()) {
            logger.log(level: .error, message: "Failed to track HTTP event, invalid method \(method)", error: nil, data: nil)
            return
        }

        if startTime <= UnsignedNumber(0) || endTime <= UnsignedNumber(0) {
            logger.log(level: .error, message: "Failed to track HTTP event, invalid start or end time", error: nil, data: nil)
            return
        }

        if Double(endTime) - Double(startTime) < 0 {
            logger.log(level: .error, message: "Failed to track HTTP event, invalid start or end time (end < start)", error: nil, data: nil)
            return
        }

        if let code = statusCode, !(100...599).contains(code) {
            logger.log(level: .error, message: "Failed to track HTTP event, invalid status code: \(code)", error: nil, data: nil)
            return
        }

        if !configProvider.shouldTrackHttpUrl(url: url) {
            logger.log(level: .debug, message: "Discarding HTTP event, URL is not allowed for tracking", error: nil, data: nil)
            return
        }

        let isRequestHeadersPresent = requestHeaders != nil && !requestHeaders!.isEmpty
        let isResponseHeadersPresent = responseHeaders != nil && !responseHeaders!.isEmpty
        // TODO: update http filter logic
//        if !configProvider.trackHttpHeaders && (isResponseHeadersPresent || isRequestHeadersPresent) {
//            logger.log(level: .debug, message: "Discarding HTTP event, request or response headers were present but not configured for tracking in Measure.init", error: nil, data: nil)
//            return
//        }

        var safeRequestHeaders = requestHeaders
        var safeResponseHeaders = responseHeaders
        // TODO: update http filter logic
//        if configProvider.trackHttpHeaders {
//            safeRequestHeaders = safeRequestHeaders?.filter { key, _ in
//                configProvider.shouldTrackHttpHeader(key: key)
//            }
//            safeResponseHeaders = safeResponseHeaders?.filter { key, _ in
//                configProvider.shouldTrackHttpHeader(key: key)
//            }
//        }

        let shouldTrackRequestHttpBody = configProvider.shouldTrackHttpBody(url: url, contentType: getContentType(headers: requestHeaders))
        let shouldTrackResponseHttpBody = configProvider.shouldTrackHttpBody(url: url, contentType: getContentType(headers: responseHeaders))

        let data = HttpData(url: url,
                            method: method,
                            statusCode: statusCode,
                            startTime: startTime,
                            endTime: endTime,
                            failureReason: error.debugDescription,
                            failureDescription: error?.localizedDescription,
                            requestHeaders: safeRequestHeaders,
                            responseHeaders: safeResponseHeaders,
                            requestBody: shouldTrackRequestHttpBody ? requestBody : nil,
                            responseBody: shouldTrackResponseHttpBody ? responseBody : nil,
                            client: client)

        self.track(data, type: .http)
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

    private func getContentType(headers: [String: String]?) -> String? {
        guard let headers = headers else { return nil }

        if let contentType = headers["Content-Type"] {
            return contentType
        }

        if let contentType = headers["content-type"] {
            return contentType
        }

        return headers.first { key, _ in
            key.caseInsensitiveCompare("Content-Type") == .orderedSame
        }?.value
    }
}
