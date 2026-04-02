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
    private var timeProvider: TimeProvider?
    private var configProvider: ConfigProvider?
    private var recentRequests: [String: UInt64] = [:]
    private let dedupeWindowMs: UInt64 = 300
    private var signalSampler: SignalSampler?
    private let isolationQueue = DispatchQueue(label: "sh.measure.interceptor.isolation")

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

    func setSignalSampler(_ signalSampler: SignalSampler) {
        self.signalSampler = signalSampler
    }

    func urlSessionTask(_ task: URLSessionTask, setState state: URLSessionTask.State) { // swiftlint:disable:this function_body_length
        guard !MSRNetworkInterceptor.isEnabled else { return }

        let currentTime = UnsignedNumber(self.timeProvider?.millisTime ?? 0)
        let capturedRequest = task.currentRequest
        let capturedResponse = task.response as? HTTPURLResponse
        let capturedError = task.error

        if state == .running {
            if task.msr_startTime == nil {
                task.msr_startTime = currentTime
            }
            return
        }

        guard state == .completed || state == .canceling else { return }

        let startTime = task.msr_startTime
        task.msr_startTime = nil

        isolationQueue.async { [weak self] in
            guard let self = self else { return }
            self.processTaskCompletion(url: capturedRequest?.url?.absoluteString,
                                       method: capturedRequest?.httpMethod,
                                       requestHeaders: capturedRequest?.allHTTPHeaderFields,
                                       requestBody: self.extractBody(from: capturedRequest),
                                       response: capturedResponse,
                                       error: capturedError,
                                       startTime: startTime,
                                       endTime: currentTime)
        }
    }

    private func processTaskCompletion(url: String?,
                                       method: String?,
                                       requestHeaders: [String: String]?,
                                       requestBody: String?,
                                       response: HTTPURLResponse?,
                                       error: Error?,
                                       startTime: UInt64?,
                                       endTime: UInt64) {
        guard let url = url,
              let httpInterceptorCallbacks = self.httpInterceptorCallbacks,
              let configProvider = self.configProvider,
              let signalSampler = self.signalSampler else { return }

        guard configProvider.shouldTrackHttpUrl(url: url) else { return }
        guard signalSampler.shouldTrackLaunchEvents() else { return }

        let normalizedMethod = method?.lowercased() ?? ""

        guard shouldRecordEvent(method: normalizedMethod, url: url, currentTime: endTime) else { return }

        let responseHeaders = response?.allHeaderFields as? [String: String]
        let safeRequestHeaders = requestHeaders?.filter { configProvider.shouldTrackHttpHeader(key: $0.key) }
        let safeResponseHeaders = responseHeaders?.filter { configProvider.shouldTrackHttpHeader(key: $0.key) }
        
        let shouldTrackReqBody = configProvider.shouldTrackHttpBody(url: url, contentType: requestHeaders?["Content-Type"])
        
        let httpData = HttpData(
            url: url,
            method: normalizedMethod,
            statusCode: response?.statusCode ?? 0,
            startTime: startTime,
            endTime: endTime,
            failureReason: error.map { String(describing: type(of: $0)) },
            failureDescription: error?.localizedDescription,
            requestHeaders: safeRequestHeaders,
            responseHeaders: safeResponseHeaders,
            requestBody: shouldTrackReqBody ? requestBody?.sanitizeRequestBody() : nil,
            responseBody: nil,
            client: "URLSession"
        )

        httpInterceptorCallbacks.onHttpCompletion(data: httpData)
    }

    private func extractBody(from request: URLRequest?) -> String? {
        if let stream = request?.httpBodyStream {
            return stream.readStream()
        } else if let data = request?.httpBody {
            return String(data: data, encoding: .utf8)
        }
        return nil
    }

    /// React Native uses multiple parallel connections for a single request, all of which are canceled
    /// once one succeeds or fails. This causes the same request to be reported multiple times.
    /// This method deduplicates events by suppressing identical method+URL combinations within a short time window.
    ///
    /// This peice of code is not thread safe and needs to be called in a dispatchQueue or a lock.
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
