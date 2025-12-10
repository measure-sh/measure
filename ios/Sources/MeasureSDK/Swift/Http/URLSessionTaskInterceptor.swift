//
//  URLSessionTaskIntercepter.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 28/11/24.
//

import Foundation

final class URLSessionTaskInterceptor {
    static let shared = URLSessionTaskInterceptor()
    private var httpInterceptorCallbacks: HttpInterceptorCallbacks?
    private var taskStartTimes: [URLSessionTask: UInt64] = [:]
    private var timeProvider: TimeProvider?
    private var allowedDomains: [String]?
    private var ignoredDomains: [String]?
    private var httpContentTypeAllowlist: [String]?
    private var defaultHttpHeadersBlocklist: [String]?
    private var configProvider: ConfigProvider?
    private var httpEventValidator: HttpEventValidator?
    private var recentRequests: [String: UInt64] = [:]
    private let dedupeWindowMs: UInt64 = 300

    private init() {}

    func setHttpInterceptorCallbacks(_ httpInterceptorCallbacks: HttpInterceptorCallbacks) {
        self.httpInterceptorCallbacks = httpInterceptorCallbacks
    }

    func setTimeProvider(_ timeProvider: TimeProvider) {
        self.timeProvider = timeProvider
    }

    func setConfigProvider(_ configProvider: ConfigProvider) {
        self.configProvider = configProvider
    }

    func setAllowedDomains(_ allowedDomains: [String]) {
        self.allowedDomains = allowedDomains
    }

    func setIgnoredDomains(_ ignoredDomains: [String]) {
        self.ignoredDomains = ignoredDomains
    }

    func setHttpContentTypeAllowlist(_ httpContentTypeAllowlist: [String]) {
        self.httpContentTypeAllowlist = httpContentTypeAllowlist
    }

    func setDefaultHttpHeadersBlocklist(_ defaultHttpHeadersBlocklist: [String]) {
        self.defaultHttpHeadersBlocklist = defaultHttpHeadersBlocklist
    }

    func setHttpEventValidator(_ httpEventValidator: HttpEventValidator) {
       self.httpEventValidator = httpEventValidator
    }

    func urlSessionTask(_ task: URLSessionTask, setState state: URLSessionTask.State) { // swiftlint:disable:this function_body_length
        guard !MSRNetworkInterceptor.isEnabled else { return }

        guard let httpInterceptorCallbacks = self.httpInterceptorCallbacks,
              let timeProvider = self.timeProvider,
              let defaultHttpHeadersBlocklist = self.defaultHttpHeadersBlocklist,
              let configProvider = self.configProvider else { return }

        guard let url = task.currentRequest?.url?.absoluteString, let httpEventValidator = self.httpEventValidator else { return }

        guard let contentType = task.currentRequest?.allHTTPHeaderFields?["Content-Type"] else { return }

        guard httpEventValidator.shouldTrackHttpEvent(self.httpContentTypeAllowlist,
                                                      contentType: contentType,
                                                      requestUrl: url,
                                                      allowedDomains: self.allowedDomains,
                                                      ignoredDomains: self.ignoredDomains) else {
            return
        }

        if state == .running, taskStartTimes[task] == nil {
            taskStartTimes[task] = UnsignedNumber(timeProvider.millisTime)
        }

        if state == .completed || state == .canceling {
            let endTime = timeProvider.millisTime
            let method = task.currentRequest?.httpMethod?.lowercased() ?? ""
            let requestHeaders = task.currentRequest?.allHTTPHeaderFields ?? [:]

            var requestBody: String?
            if let requestBodyStream = task.currentRequest?.httpBodyStream {
                requestBody = requestBodyStream.readStream()
            } else if let requestBodyData = task.currentRequest?.httpBody,
                      let requestBodyString = String(data: requestBodyData, encoding: .utf8) {
                requestBody = requestBodyString
            }

            guard let response = task.response as? HTTPURLResponse else { return }

            let statusCode = response.statusCode
            let responseHeaders = response.allHeaderFields as? [String: String] ?? [:]
            let responseBody: String? = nil

            let failureReason = task.error?.localizedDescription
            let failureDescription = (task.error as NSError?)?.domain
            let startTime = taskStartTimes[task]

            let client = "URLSession"

            let httpData = HttpData(
                url: url.removeHttpPrefix(),
                method: method,
                statusCode: statusCode,
                startTime: startTime,
                endTime: UnsignedNumber(endTime),
                failureReason: failureReason,
                failureDescription: failureDescription,
                requestHeaders: configProvider.trackHttpHeaders ? requestHeaders.filter { !defaultHttpHeadersBlocklist.contains($0.key) } : nil,
                responseHeaders: configProvider.trackHttpHeaders ? responseHeaders.filter { !defaultHttpHeadersBlocklist.contains($0.key) } : nil,
                requestBody: configProvider.trackHttpBody ? httpEventValidator.validateAndTrimBody(requestBody?.sanitizeRequestBody(), maxBodySizeBytes: configProvider.maxBodySizeBytes) : nil,
                responseBody: configProvider.trackHttpBody ? httpEventValidator.validateAndTrimBody(responseBody?.sanitizeRequestBody(), maxBodySizeBytes: configProvider.maxBodySizeBytes) : nil,
                client: client)

            taskStartTimes.removeValue(forKey: task)

            if shouldRecordEvent(method: method, url: url, currentTime: UInt64(endTime)) {
                httpInterceptorCallbacks.onHttpCompletion(data: httpData)
            }
        }
    }

    private func shouldRecordEvent(method: String, url: String, currentTime: UInt64) -> Bool {
        let key = "\(method.uppercased()) \(url)"
        var shouldRecord = true

        if let lastTime = recentRequests[key], currentTime - lastTime < dedupeWindowMs {
            shouldRecord = false
        } else {
            recentRequests[key] = currentTime
        }

        recentRequests = recentRequests.filter { currentTime - $0.value < dedupeWindowMs }

        return shouldRecord
    }
}

