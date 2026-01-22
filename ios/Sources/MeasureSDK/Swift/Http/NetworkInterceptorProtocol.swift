//
//  NetworkInterceptorProtocol.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/11/24.
//

import Foundation

// Custom URLProtocol for intercepting network requests and responses
class NetworkInterceptorProtocol: URLProtocol {
    private var dataTask: URLSessionDataTask?
    private var startTime: UnsignedNumber?
    private var responseBody: Data?
    private var httpResponse: HTTPURLResponse?
    private var httpContentTypeAllowlist: [String]?
    private var defaultHttpHeadersBlocklist: [String]?

    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = nil // Prevent recursive interception
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    static var httpInterceptorCallbacks: HttpInterceptorCallbacks?
    static var timeProvider: TimeProvider?
    static var allowedDomains: [String]?
    static var ignoredDomains: [String]?
    static var httpContentTypeAllowlist: [String]?
    static var defaultHttpHeadersBlocklist: [String]?
    static var configProvider: ConfigProvider?
    static var httpEventValidator: HttpEventValidator?

    static func setTimeProvider(_ timeProvider: TimeProvider) {
        self.timeProvider = timeProvider
    }

    static func setConfigProvider(_ configProvider: ConfigProvider) {
        self.configProvider = configProvider
    }

    static func setHttpInterceptorCallbacks(_ httpInterceptorCallbacks: HttpInterceptorCallbacks) {
        self.httpInterceptorCallbacks = httpInterceptorCallbacks
    }

    static func setAllowedDomains(_ allowedDomains: [String]) {
        self.allowedDomains = allowedDomains
    }

    static func setIgnoredDomains(_ ignoredDomains: [String]) {
        self.ignoredDomains = ignoredDomains
    }

    static func setHttpContentTypeAllowlist(_ httpContentTypeAllowlist: [String]) {
        self.httpContentTypeAllowlist = httpContentTypeAllowlist
    }

    static func setDefaultHttpHeadersBlocklist(_ defaultHttpHeadersBlocklist: [String]) {
        self.defaultHttpHeadersBlocklist = defaultHttpHeadersBlocklist
    }

    static func setHttpEventValidator(_ httpEventValidator: HttpEventValidator) {
        self.httpEventValidator = httpEventValidator
    }

    override class func canInit(with request: URLRequest) -> Bool {
        // Prevent infinite loop by checking a custom property
        return URLProtocol.property(forKey: networkInterceptorHandledKey, in: request) == nil
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        return request
    }

    override func startLoading() {
        if let timeProvider = NetworkInterceptorProtocol.timeProvider {
            startTime = UnsignedNumber(timeProvider.millisTime)
        }

        if let taggedRequest = (request as NSURLRequest).mutableCopy() as? NSMutableURLRequest {
            URLProtocol.setProperty(true, forKey: networkInterceptorHandledKey, in: taggedRequest)

            dataTask = session.dataTask(with: taggedRequest as URLRequest)
            dataTask?.resume()
        }
    }

    override func stopLoading() {
        dataTask?.cancel()
    }

    private func extractHeaders(from response: URLResponse?) -> [String: String]? {
        guard let httpResponse = response as? HTTPURLResponse else { return nil }
        return httpResponse.allHeaderFields as? [String: String]
    }
}

extension NetworkInterceptorProtocol: URLSessionDataDelegate {
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        if responseBody == nil {
            responseBody = Data()
        }
        responseBody?.append(data)
        client?.urlProtocol(self, didLoad: data)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        if let httpResponse = response as? HTTPURLResponse {
            self.httpResponse = httpResponse
        }

        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        defer {
            if let error = error {
                client?.urlProtocol(self, didFailWithError: error)
            } else {
                client?.urlProtocolDidFinishLoading(self)
            }
        }

        guard let timeProvider = NetworkInterceptorProtocol.timeProvider,
              let httpInterceptorCallbacks = NetworkInterceptorProtocol.httpInterceptorCallbacks,
              let configProvider = NetworkInterceptorProtocol.configProvider,
              let httpResponse = task.response as? HTTPURLResponse,
              let urlString = request.url?.absoluteString else { return }

        guard configProvider.shouldTrackHttpUrl(url: urlString) else {
            return
        }

        let endTime = UnsignedNumber(timeProvider.millisTime)

        var requestBody: String?
        if let requestBodyStream = request.httpBodyStream {
            requestBody = requestBodyStream.readStream()
        } else if let requestBodyData = request.httpBody {
            requestBody = String(data: requestBodyData, encoding: .utf8)
        }

        let responseBodyString = responseBody.flatMap {
            String(data: $0, encoding: .utf8)
        }

        let safeRequestHeaders = request.allHTTPHeaderFields?
            .filter { configProvider.shouldTrackHttpHeader(key: $0.key) }

        let safeResponseHeaders = extractHeaders(from: httpResponse)?
            .filter { configProvider.shouldTrackHttpHeader(key: $0.key) }

        let shouldTrackRequestBody = configProvider.shouldTrackHttpBody(url: urlString,
                                                                        contentType: request.allHTTPHeaderFields?["Content-Type"])

        let shouldTrackResponseBody = configProvider.shouldTrackHttpBody(url: urlString,
                                                                         contentType: httpResponse.allHeaderFields["Content-Type"] as? String)

        let httpData = HttpData(url: urlString.removeHttpPrefix(),
                                method: request.httpMethod?.lowercased() ?? "",
                                statusCode: httpResponse.statusCode,
                                startTime: startTime,
                                endTime: endTime,
                                failureReason: error.map { String(describing: type(of: $0)) },
                                failureDescription: error?.localizedDescription,
                                requestHeaders: safeRequestHeaders,
                                responseHeaders: safeResponseHeaders,
                                requestBody: shouldTrackRequestBody
                                ? requestBody?.sanitizeRequestBody()
                                : nil,
                                responseBody: shouldTrackResponseBody
                                ? responseBodyString?.sanitizeRequestBody()
                                : nil,
                                client: "URLSession")

        httpInterceptorCallbacks.onHttpCompletion(data: httpData)
    }
}
