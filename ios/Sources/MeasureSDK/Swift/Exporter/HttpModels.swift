//
//  HttpModels.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/10/24.
//

import Foundation

enum MultipartData {
    case formField(name: String, value: Data)
    case fileData(name: String, filename: String, data: Data)
}

enum HttpResponse {
    case success(body: String?, eTag: String?)
    case error(HttpError)
}

enum HttpError {
    case unknownError(String)
    case rateLimitError(body: String?)
    case clientError(responseCode: Int, body: String?)
    case serverError(responseCode: Int, body: String?)
}

enum HttpMethod: String {
    case put = "PUT"
    case post = "POST"
    case get = "GET"
}
