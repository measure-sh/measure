//
//  NetworkClient.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/10/24.
//

import Foundation

protocol NetworkClient {
    func execute(batchId: String, events: [EventEntity], spans: [SpanEntity]) -> HttpResponse
    func getConfig(eTag: String?) -> (DynamicConfig?, String?)
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
        let serializedEvents = self.serializeEvents(events: events)
        let serializedSpans = self.serializeSpans(spans: spans)
        
        if serializedEvents.isEmpty && serializedSpans.isEmpty {
            return .success(body: "{}", eTag: nil)
        }

        let payload: [String: Any] = [
            "events": serializedEvents,
            "spans": serializedSpans
        ]

        guard let jsonBody = try? JSONSerialization.data(withJSONObject: payload, options: []) else {
            return .error(.unknownError("Failed to serialize batch JSON payload"))
        }

        return httpClient.sendJsonRequest(url: baseUrl.appendingPathComponent(eventsEndpoint),
                                          method: .put,
                                          headers: [
                                            authorization: "\(bearer) \(apiKey)",
                                            msrRequestId: batchId
                                          ],
                                          jsonBody: jsonBody)
    }

    func getConfig(eTag: String?) -> (DynamicConfig?, String?) {
        let url = baseUrl.appendingPathComponent("config")

        var headers: [String: String] = [
            authorization: "\(bearer) \(apiKey)"
        ]

        if let eTag {
            headers["If-None-Match"] = eTag
        }

        let response = httpClient.sendJsonRequest(url: url,
                                                  method: .get,
                                                  headers: headers,
                                                  jsonBody: Data())

        switch response {
        case .success(let body, let eTag):
            guard let body,
                  let data = body.data(using: .utf8) else {
                return (nil, nil)
            }

            do {
                let decoder = JSONDecoder()
                let config = try decoder.decode(BaseDynamicConfig.self, from: data)

                return (config, eTag)
            } catch {
                return (nil, nil)
            }

        case .error(let error):
            if case .clientError(let code, _) = error, code == 304 {
                return (nil, nil)
            }
            return (nil, nil)
        }
    }

    private func serializeEvents(events: [EventEntity]) -> [[String: Any]] {
        return events.compactMap { event in
            guard let eventWrapperData = eventSerializer.getSerialisedEvent(for: event) else {
                return [:]
            }

            guard var fullEventDict = (try? JSONSerialization.jsonObject(with: eventWrapperData, options: [])) as? [String: Any] else {
                return [:]
            }

            if let attachments = fullEventDict["attachments"] as? [[String: Any]] {
                let cleanedAttachments = attachments.map { attachment in
                    let requiredKeys: Set<String> = ["id", "name", "type"]
                    return attachment.filter { requiredKeys.contains($0.key) }
                }

                fullEventDict["attachments"] = cleanedAttachments
            }

            return fullEventDict
        }
    }

    private func serializeSpans(spans: [SpanEntity]) -> [[String: Any]] {
        let encoder = JSONEncoder()
        
        return spans.compactMap { spanEntity in
            let spanCodable = spanEntity.toSpanDataCodable()

            guard let data = try? encoder.encode(spanCodable) else { return nil }

            guard let jsonObject = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
                return nil
            }
            return jsonObject
        }
    }
}
