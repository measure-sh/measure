//
//  NetworkClient.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/10/24.
//

import Foundation

protocol NetworkClient {
    func execute(batchId: String, events: [String]) -> HttpResponse
}

final class BaseNetworkClient: NetworkClient {
    private let baseUrl: URL
    private let apiKey: String
    private let httpClient: HttpClient
    private let dispatchQueue: DispatchQueue

    init(client: Client, httpClient: HttpClient, dispatchQueue: DispatchQueue) {
        self.baseUrl = client.apiUrl
        self.apiKey = client.apiKey
        self.httpClient = httpClient
        self.dispatchQueue = dispatchQueue
    }

    func execute(batchId: String, events: [String]) -> HttpResponse {
        let multipartData: [MultipartData] = events.map { .formField(name: "event", value: $0) }

        return self.dispatchQueue.sync {
            httpClient.sendMultipartRequest(url: baseUrl.appendingPathComponent(eventsEndpoint),
                                            method: .put,
                                            headers: ["Authorization": "Bearer \(apiKey)",
                                                      "msr-req-id": batchId],
                                            multipartData: multipartData)
        }
    }
}
