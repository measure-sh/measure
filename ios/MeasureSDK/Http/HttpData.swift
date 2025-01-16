//
//  HttpData.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 28/11/24.
//

import Foundation

struct HttpData: Codable {
    /// The complete URL of the request.
    let url: String

    /// HTTP method, like get, post, put, etc. In lowercase.
    let method: String

    /// HTTP response code. Example: 200, 401, 500, etc.
    let statusCode: Int?

    /// The uptime at which the HTTP call started, in milliseconds.
    let startTime: UnsignedNumber?

    /// The uptime at which the HTTP call ended, in milliseconds.
    let endTime: UnsignedNumber?

    /// The reason for the failure. Typically the error class name.
    let failureReason: String?

    /// The description of the failure. Typically the error message.
    let failureDescription: String?

    /// The request headers.
    var requestHeaders: [String: String]?

    /// The response headers.
    var responseHeaders: [String: String]?

    /// The request body.
    var requestBody: String?

    /// The response body.
    var responseBody: String?

    /// The name of the client that sent the request.
    let client: String

    enum CodingKeys: String, CodingKey {
        case url
        case method
        case statusCode = "status_code"
        case startTime = "start_time"
        case endTime = "end_time"
        case failureReason = "failure_reason"
        case failureDescription = "failure_description"
        case requestHeaders = "request_headers"
        case responseHeaders = "response_headers"
        case requestBody = "request_body"
        case responseBody = "response_body"
        case client
    }
}
