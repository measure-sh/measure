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
    private var configProvider: ConfigProvider?
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

    func urlSessionTask(_ task: URLSessionTask, setState state: URLSessionTask.State) { // swiftlint:disable:this function_body_length
        guard !MSRNetworkInterceptor.isEnabled else { return }

        guard let httpInterceptorCallbacks = self.httpInterceptorCallbacks,
              let timeProvider = self.timeProvider,
              let configProvider = self.configProvider,
              let url = task.currentRequest?.url?.absoluteString else { return }

        guard configProvider.shouldTrackHttpUrl(url: url) else {
            return
        }

        if state == .running, taskStartTimes[task] == nil {
            taskStartTimes[task] = UnsignedNumber(timeProvider.millisTime)
            return
        }

        guard state == .completed || state == .canceling else { return }

        let endTime = UnsignedNumber(timeProvider.millisTime)
        let method = task.currentRequest?.httpMethod?.lowercased() ?? ""

        let requestHeaders = task.currentRequest?.allHTTPHeaderFields

        var requestBody: String?
        if let stream = task.currentRequest?.httpBodyStream {
            requestBody = stream.readStream()
        } else if let data = task.currentRequest?.httpBody {
            requestBody = String(data: data, encoding: .utf8)
        }

        guard let response = task.response as? HTTPURLResponse else {
            taskStartTimes.removeValue(forKey: task)
            return
        }

        let statusCode = response.statusCode
        let responseHeaders = response.allHeaderFields as? [String: String]

        let startTime = taskStartTimes[task]
        taskStartTimes.removeValue(forKey: task)

        let safeRequestHeaders = requestHeaders?.filter { configProvider.shouldTrackHttpHeader(key: $0.key) }
        let safeResponseHeaders = responseHeaders?.filter { configProvider.shouldTrackHttpHeader(key: $0.key) }
        let shouldTrackRequestBody = configProvider.shouldTrackHttpBody(url: url, contentType: requestHeaders?["Content-Type"])

        let shouldTrackResponseBody = configProvider.shouldTrackHttpBody(url: url, contentType: responseHeaders?["Content-Type"])

        let httpData = HttpData(
            url: url.removeHttpPrefix(),
            method: method,
            statusCode: statusCode,
            startTime: startTime,
            endTime: endTime,
            failureReason: task.error.map { String(describing: type(of: $0)) },
            failureDescription: task.error?.localizedDescription,
            requestHeaders: safeRequestHeaders,
            responseHeaders: safeResponseHeaders,
            requestBody: shouldTrackRequestBody
                ? requestBody?.sanitizeRequestBody()
                : nil,
            responseBody: shouldTrackResponseBody
                ? nil
                : nil,
            client: "URLSession"
        )

        if shouldRecordEvent(method: method, url: url, currentTime: UInt64(endTime)) {
            httpInterceptorCallbacks.onHttpCompletion(data: httpData)
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

