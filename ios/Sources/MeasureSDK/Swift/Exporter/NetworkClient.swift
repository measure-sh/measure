//
//  NetworkClient.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/10/24.
//

import Foundation

protocol NetworkClient {
    func execute(batchId: String, events: [EventEntity], spans: [SpanEntity]) -> HttpResponse
}

final class BaseNetworkClient: NetworkClient {
    private let baseUrl: URL
    private let apiKey: String
    private let httpClient: HttpClient
    private let eventSerializer: EventSerializer
    private let systemFileManager: SystemFileManager

    init(client: Client, httpClient: HttpClient, eventSerializer: EventSerializer, systemFileManager: SystemFileManager) {
        self.baseUrl = client.apiUrl
        self.apiKey = client.apiKey
        self.httpClient = httpClient
        self.eventSerializer = eventSerializer
        self.systemFileManager = systemFileManager
    }

    func execute(batchId: String, events: [EventEntity], spans: [SpanEntity]) -> HttpResponse {
        var multipartData = [MultipartData]()
        for event in events {
            if let serialisedEvent = eventSerializer.getSerialisedEvent(for: event) {
                multipartData.append(.formField(name: formFieldEvent, value: serialisedEvent))
            }
            if let attachments = event.getAttachments() {
                for attachment in attachments {
                    if let bytes = attachment.bytes {
                        multipartData.append(.fileData(name: "blob-\(attachment.id)", filename: attachment.name, data: bytes))
                    }
                }
            }
        }

        for spanEntity in spans {
            let span = spanEntity.toSpanDataCodable()

            let encoder = JSONEncoder()
            if let data = try? encoder.encode(span) {
                multipartData.append(.formField(name: formFieldSpan, value: data))
            }
        }

        return httpClient.sendMultipartRequest(url: baseUrl.appendingPathComponent(eventsEndpoint),
                                               method: .put,
                                               headers: [authorization: "\(bearer) \(apiKey)",
                                                         msrRequestId: batchId],
                                               multipartData: multipartData)
    }
}
