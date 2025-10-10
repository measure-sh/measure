//
//  HttpClient.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/10/24.
//

import Foundation

protocol HttpClient {
    func sendJsonRequest(url: URL, method: HttpMethod, headers: [String: String], jsonBody: Data) -> HttpResponse
    func uploadFile(url: URL, method: HttpMethod, contentType: String, headers: [String: String], fileData: Data) -> HttpResponse
}

final class BaseHttpClient: HttpClient {
    private let logger: Logger
    private let maxRedirects = 5
    private let session: URLSession
    private let configProvider: ConfigProvider

    init(logger: Logger, configProvider: ConfigProvider) {
        self.logger = logger
        self.configProvider = configProvider
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = configProvider.timeoutIntervalForRequest
        self.session = URLSession(configuration: configuration)
    }

    func sendJsonRequest(url: URL, method: HttpMethod, headers: [String: String], jsonBody: Data) -> HttpResponse {
        return sendJsonRequestWithRedirects(url: url, method: method, headers: headers, jsonBody: jsonBody, redirectCount: 0)
    }

    private func sendJsonRequestWithRedirects(url: URL, method: HttpMethod, headers: [String: String], jsonBody: Data, redirectCount: Int) -> HttpResponse {
        if redirectCount >= maxRedirects {
            self.logger.internalLog(level: .error, message: "Too many redirects for JSON request to \(url.absoluteString)", error: nil, data: nil)
            return .error(.unknownError("Too many redirects"))
        }

        var request = createJsonRequest(url: url, method: method, headers: headers)
        request.httpBody = jsonBody

        let semaphore = DispatchSemaphore(value: 0)
        var response: HttpResponse!

        let task = session.dataTask(with: request) { data, urlResponse, error in
            response = self.handleRequestCompletion(data: data, urlResponse: urlResponse, error: error) { newUrl in
                self.sendJsonRequestWithRedirects(url: newUrl, method: method, headers: headers, jsonBody: jsonBody, redirectCount: redirectCount + 1)
            }
            semaphore.signal()
        }

        task.resume()
        semaphore.wait()

        return response
    }

    func uploadFile(url: URL, method: HttpMethod, contentType: String, headers: [String: String], fileData: Data) -> HttpResponse {
        return uploadFileWithRedirects(url: url, method: method, contentType: contentType, headers: headers, fileData: fileData, redirectCount: 0)
    }

    private func uploadFileWithRedirects(url: URL, method: HttpMethod, contentType: String, headers: [String: String], fileData: Data, redirectCount: Int) -> HttpResponse {
        if redirectCount >= maxRedirects {
            self.logger.internalLog(level: .error, message: "Too many redirects for file upload to \(url.absoluteString)", error: nil, data: nil)
            return .error(.unknownError("Too many redirects"))
        }

        var request = createFileUploadRequest(url: url, method: method, contentType: contentType, headers: headers, fileSize: Int64(fileData.count))
        request.httpBody = fileData // Set the file body

        let semaphore = DispatchSemaphore(value: 0)
        var response: HttpResponse!

        let task = session.dataTask(with: request) { data, urlResponse, error in
            response = self.handleRequestCompletion(data: data, urlResponse: urlResponse, error: error) { newUrl in
                // Handle recursive redirect for file upload
                self.uploadFileWithRedirects(url: newUrl, method: method, contentType: contentType, headers: headers, fileData: fileData, redirectCount: redirectCount + 1)
            }
            semaphore.signal()
        }

        task.resume()
        semaphore.wait()

        return response
    }

    private func handleRequestCompletion(data: Data?, urlResponse: URLResponse?, error: Error?, redirectHandler: (URL) -> HttpResponse) -> HttpResponse {
        if let error = error {
            self.logger.internalLog(level: .error, message: "Failed to send request: \(error.localizedDescription)", error: nil, data: nil)
            return .error(.unknownError(error.localizedDescription))
        } else if let httpResponse = urlResponse as? HTTPURLResponse, self.isRedirect(httpResponse.statusCode) {
            if let location = httpResponse.allHeaderFields["Location"] as? String, let newUrl = self.resolveRedirectUrl(baseUrl: urlResponse!.url!, location: location) {
                self.logger.internalLog(level: .info, message: "Redirecting to: \(newUrl.absoluteString)", error: nil, data: nil)
                return redirectHandler(newUrl)
            } else {
                return .error(.unknownError("Redirect location missing"))
            }
        } else {
            return self.processResponse(data: data, urlResponse: urlResponse)
        }
    }


    private func isRedirect(_ statusCode: Int) -> Bool {
        return statusCode == 307 || statusCode == 308
    }

    private func resolveRedirectUrl(baseUrl: URL, location: String) -> URL? {
        return URL(string: location, relativeTo: baseUrl)
    }

    func createJsonRequest(url: URL, method: HttpMethod, headers: [String: String]) -> URLRequest {
        var request = URLRequest(url: url)
        request.timeoutInterval = configProvider.timeoutIntervalForRequest
        request.httpMethod = method.rawValue

        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        headers.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        if let customHeaders = getCustomHeaders() {
            customHeaders.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        }

        return request
    }

    func createFileUploadRequest(url: URL, method: HttpMethod, contentType: String, headers: [String: String], fileSize: Int64) -> URLRequest {
        var request = URLRequest(url: url)
        request.timeoutInterval = configProvider.timeoutIntervalForRequest
        request.httpMethod = method.rawValue

        request.setValue(contentType, forHTTPHeaderField: "Content-Type")

        headers.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        if let customHeaders = getCustomHeaders() {
            customHeaders.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        }

        if headers["Content-Length"] == nil && headers["content-length"] == nil {
            request.setValue("\(fileSize)", forHTTPHeaderField: "Content-Length")
        }

        return request
    }


    private func processResponse(data: Data?, urlResponse: URLResponse?) -> HttpResponse {
        guard let httpResponse = urlResponse as? HTTPURLResponse else {
            return .error(.unknownError("Invalid response"))
        }

        let responseBody = data.flatMap({ String(data: $0, encoding: .utf8) })

        if let body = responseBody {
            logger.internalLog(level: .info, message: "Response (\(httpResponse.statusCode)): \(body)", error: nil, data: nil)
        } else {
            logger.internalLog(level: .info, message: "Response (\(httpResponse.statusCode)): No body", error: nil, data: nil)
        }

        switch httpResponse.statusCode {
        case 200..<300:
            return .success(body: responseBody)
        case 429:
            return .error(.rateLimitError(body: responseBody))
        case 400..<500:
            return .error(.clientError(responseCode: httpResponse.statusCode, body: responseBody))
        case 500..<600:
            return .error(.serverError(responseCode: httpResponse.statusCode, body: responseBody))
        default:
            return .error(.unknownError("Unexpected response code: \(httpResponse.statusCode)"))
        }
    }

    func getCustomHeaders() -> [String: String]? {
        guard let requestHeadersProvider = configProvider.requestHeadersProvider else {
            return nil
        }

        let disallowed = Set(configProvider.disallowedCustomHeaders.map { $0.lowercased() })

        guard let headers = requestHeadersProvider.getRequestHeaders() as? [String: String] else {
            return nil
        }

        return headers.filter { key, _ in
            !disallowed.contains(key.lowercased())
        }
    }
}
