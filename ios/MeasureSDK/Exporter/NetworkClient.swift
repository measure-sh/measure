//
//  NetworkClient.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/10/24.
//

import Foundation

protocol NetworkClient {
    func execute(batchId: String, events: [EventEntity]) -> HttpResponse
}

final class BaseNetworkClient: NetworkClient {
    private let baseUrl: URL
    private let apiKey: String
    private let httpClient: HttpClient
    private let eventSerializer: EventSerializer

    init(client: Client, httpClient: HttpClient, eventSerializer: EventSerializer) {
        self.baseUrl = client.apiUrl
        self.apiKey = client.apiKey
        self.httpClient = httpClient
        self.eventSerializer = eventSerializer
    }

    func execute(batchId: String, events: [EventEntity]) -> HttpResponse {
        let multipartData: [MultipartData] = events.compactMap { eventSerializer.getSerialisedEvent(for: $0) }.map { .formField(name: formFieldEvent, value: $0) }

        return httpClient.sendMultipartRequest(url: baseUrl.appendingPathComponent(eventsEndpoint),
                                               method: .put,
                                               headers: [authorization: "\(bearer) \(apiKey)",
                                                         msrRequestId: batchId],
                                               multipartData: multipartData)
    }
}
