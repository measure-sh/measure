//
//  MockHttpClient.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/01/26.
//

import Foundation
@testable import Measure

final class MockHttpClient: HttpClient {
    private(set) var sentUrls: [URL] = []
    private(set) var uploadedUrls: [URL] = []

    var sendResponse: HttpResponse = .success(body: nil, eTag: nil)
    var uploadResponse: HttpResponse = .success(body: nil, eTag: nil)

    func sendJsonRequest(
        url: URL,
        method: HttpMethod,
        headers: [String: String],
        jsonBody: Data
    ) -> HttpResponse {
        sentUrls.append(url)
        return sendResponse
    }

    func uploadFile(
        url: URL,
        method: HttpMethod,
        contentType: String,
        headers: [String: String],
        fileData: Data
    ) -> HttpResponse {
        uploadedUrls.append(url)
        return uploadResponse
    }
}
