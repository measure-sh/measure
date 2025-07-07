//
//  HttpClient.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/10/24.
//

import Foundation

protocol HttpClient {
    func sendMultipartRequest(url: URL, method: HttpMethod, headers: [String: String], multipartData: [MultipartData]) -> HttpResponse
}

final class BaseHttpClient: HttpClient {
    private let logger: Logger
    private let boundary = multipartBoundry
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

    func sendMultipartRequest(url: URL, method: HttpMethod, headers: [String: String], multipartData: [MultipartData]) -> HttpResponse {
        return sendMultipartRequestWithRedirects(url: url, method: method, headers: headers, multipartData: multipartData, redirectCount: 0)
    }

    private func sendMultipartRequestWithRedirects(url: URL, method: HttpMethod, headers: [String: String], multipartData: [MultipartData], redirectCount: Int) -> HttpResponse {
        if redirectCount >= maxRedirects {
            return .error(.unknownError("Too many redirects"))
        }

        var request = createRequest(url: url, method: method, headers: headers)
        let body = createMultipartBody(multipartData)
        request.httpBody = body

        let semaphore = DispatchSemaphore(value: 0)
        var response: HttpResponse!

        let task = session.dataTask(with: request) { data, urlResponse, error in
            if let error = error {
                self.logger.internalLog(level: .error, message: "Failed to send request: \(error.localizedDescription)", error: nil, data: nil)
                response = .error(.unknownError(error.localizedDescription))
            } else if let httpResponse = urlResponse as? HTTPURLResponse, self.isRedirect(httpResponse.statusCode) {
                if let location = httpResponse.allHeaderFields["Location"] as? String, let newUrl = self.resolveRedirectUrl(baseUrl: url, location: location) {
                    self.logger.internalLog(level: .info, message: "Redirecting to: \(newUrl.absoluteString)", error: nil, data: nil)
                    response = self.sendMultipartRequestWithRedirects(url: newUrl, method: method, headers: headers, multipartData: multipartData, redirectCount: redirectCount + 1)
                } else {
                    response = .error(.unknownError("Redirect location missing"))
                }
            } else {
                response = self.processResponse(data: data, urlResponse: urlResponse)
            }
            semaphore.signal()
        }

        task.resume()
        semaphore.wait()

        return response
    }

    private func isRedirect(_ statusCode: Int) -> Bool {
        return statusCode == 307 || statusCode == 308
    }

    private func resolveRedirectUrl(baseUrl: URL, location: String) -> URL? {
        return URL(string: location, relativeTo: baseUrl)
    }

    func createRequest(url: URL, method: HttpMethod, headers: [String: String]) -> URLRequest {
        var request = URLRequest(url: url)
        request.timeoutInterval = configProvider.timeoutIntervalForRequest
        request.httpMethod = method.rawValue
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        headers.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        if let customHeaders = getCustomHeaders() {
            customHeaders.forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        }

        return request
    }

    func createMultipartBody(_ multipartData: [MultipartData]) -> Data {
        var body = Data()

        for data in multipartData {
            switch data {
            case let .formField(name, value):
                var value = value
                body.append(Data("--\(boundary)\r\n".utf8))
                body.append(Data("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".utf8))
                value.append(Data("\r\n".utf8))
                body.append(value)
            case let .fileData(name, filename, data):
                body.append(Data("--\(boundary)\r\n".utf8))
                body.append(Data("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n\r\n".utf8))
                body.append(data)
                body.append(Data("\r\n".utf8))
            }
        }
        body.append(Data("--\(boundary)--\r\n".utf8))
        return body
    }

    private func processResponse(data: Data?, urlResponse: URLResponse?) -> HttpResponse {
        guard let httpResponse = urlResponse as? HTTPURLResponse,
                let responseBody = data.flatMap({ String(data: $0, encoding: .utf8) }) else {
            return .error(.unknownError("Invalid response"))
        }

        logger.internalLog(level: .info, message: "Response: \(responseBody)", error: nil, data: nil)

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

        return requestHeadersProvider.getRequestHeaders().filter { key, _ in
            !disallowed.contains(key.lowercased())
        }
    }
}
