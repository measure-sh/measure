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

    private init() {}

    func setHttpInterceptorCallbacks(_ httpInterceptorCallbacks: HttpInterceptorCallbacks) {
        self.httpInterceptorCallbacks = httpInterceptorCallbacks
    }

    func setTimeProvider(_ timeProvider: TimeProvider) {
        self.timeProvider = timeProvider
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

    func urlSessionTask(_ task: URLSessionTask, setState state: URLSessionTask.State) { // swiftlint:disable:this cyclomatic_complexity
        guard !MSRNetworkInterceptor.isEnabled else { return }

        guard let httpInterceptorCallbacks = self.httpInterceptorCallbacks,
              let timeProvider = self.timeProvider,
              let defaultHttpHeadersBlocklist = self.defaultHttpHeadersBlocklist else { return }

        guard let url = task.currentRequest?.url?.absoluteString else { return }

        guard let contentType = task.currentRequest?.allHTTPHeaderFields?["Content-Type"] else { return }

        // Skip if content type is not in httpContentTypeAllowlist
        if let httpContentTypeAllowlist = self.httpContentTypeAllowlist, !httpContentTypeAllowlist.contains(where: { contentType.contains($0) }) { return }

        // Skip if the URL is in ignored domains
        if let ignoreDomains = self.ignoredDomains.flatMap({ $0 }), ignoreDomains.contains(where: { url.contains($0) }) { return }

        // Skip if allowedDomains is non-empty and the URL doesn't match any domain in allowedDomains
        if let allowedDomains = self.allowedDomains.flatMap({ $0 }), !allowedDomains.isEmpty && !allowedDomains.contains(where: { url.contains($0) }) { return }

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

            let failureReason: String? = task.error?.localizedDescription
            let failureDescription: String? = (task.error as NSError?)?.domain

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
                requestHeaders: requestHeaders.filter { !defaultHttpHeadersBlocklist.contains($0.key) },
                responseHeaders: responseHeaders.filter { !defaultHttpHeadersBlocklist.contains($0.key) },
                requestBody: requestBody?.sanitizeRequestBody(),
                responseBody: responseBody?.sanitizeRequestBody(),
                client: client
            )

            taskStartTimes.removeValue(forKey: task)
            httpInterceptorCallbacks.onHttpCompletion(data: httpData)
        }
    }
}
