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

        if let timeProvider = NetworkInterceptorProtocol.timeProvider,
           let httpInterceptorCallbacks = NetworkInterceptorProtocol.httpInterceptorCallbacks,
           let defaultHttpHeadersBlocklist = NetworkInterceptorProtocol.defaultHttpHeadersBlocklist,
           let url = request.url?.absoluteString,
           let configProvider = NetworkInterceptorProtocol.configProvider,
           let httpEventValidator = NetworkInterceptorProtocol.httpEventValidator {
            guard let contentType = task.currentRequest?.allHTTPHeaderFields?["Content-Type"] else { return }

            guard httpEventValidator.shouldTrackHttpEvent(NetworkInterceptorProtocol.httpContentTypeAllowlist,
                                                          contentType: contentType,
                                                          requestUrl: url,
                                                          allowedDomains: NetworkInterceptorProtocol.allowedDomains,
                                                          ignoredDomains: NetworkInterceptorProtocol.ignoredDomains) else {
                return
            }

            let endTime = UnsignedNumber(timeProvider.millisTime)

            var requestBody: String?
            if let requestBodyStream = request.httpBodyStream {
                requestBody = requestBodyStream.readStream()
            } else if let requestBodyData = request.httpBody, let requestBodyString = String(data: requestBodyData, encoding: .utf8) {
                requestBody = requestBodyString
            }

            let responseString = responseBody.map { String(data: $0, encoding: .utf8) } ?? nil

            let httpData = HttpData(
                url: url.removeHttpPrefix(),
                method: request.httpMethod?.lowercased() ?? "",
                statusCode: httpResponse?.statusCode,
                startTime: startTime,
                endTime: endTime,
                failureReason: error.map { String(describing: type(of: $0)) },
                failureDescription: error?.localizedDescription,
                requestHeaders: configProvider.trackHttpHeaders ? request.allHTTPHeaderFields?.filter { !defaultHttpHeadersBlocklist.contains($0.key) } : nil,
                responseHeaders: configProvider.trackHttpHeaders ? extractHeaders(from: httpResponse)?.filter { !defaultHttpHeadersBlocklist.contains($0.key) } : nil,
                requestBody: configProvider.trackHttpBody ? httpEventValidator.validateAndTrimBody(requestBody?.sanitizeRequestBody(), maxBodySizeBytes: configProvider.maxBodySizeBytes) : nil,
                responseBody: configProvider.trackHttpBody ? httpEventValidator.validateAndTrimBody(responseString?.sanitizeRequestBody(), maxBodySizeBytes: configProvider.maxBodySizeBytes) : nil,
                client: "URLSession")

            httpInterceptorCallbacks.onHttpCompletion(data: httpData)
        }
    }
}
