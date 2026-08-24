//
//  NetworkClient.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/10/24.
//

import Foundation

enum ConfigResponse {
    case success(config: BaseDynamicConfig, eTag: String?, cacheControl: Number)
    case notModified
    case error
}

protocol NetworkClient {
    func execute(batchId: String, events: [EventEntity], spans: [SpanEntity]) -> HttpResponse
    func getConfig(eTag: String?) -> ConfigResponse
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
        let serializedEvents = events.compactMap { eventSerializer.getSerialisedEvent(for: $0) }
        let serializedSpans = spans.compactMap { eventSerializer.serializeSpan($0) }

        if serializedEvents.isEmpty && serializedSpans.isEmpty {
            return .success(body: "{}", eTag: nil)
        }

        let jsonBody = buildBatchPayload(events: serializedEvents, spans: serializedSpans)

        return httpClient.sendJsonRequest(url: baseUrl.appendingPathComponent(eventsEndpoint),
                                          method: .put,
                                          headers: [
                                            authorization: "\(bearer) \(apiKey)",
                                            msrRequestId: batchId
                                          ],
                                          jsonBody: jsonBody)
    }

    func getConfig(eTag: String?) -> ConfigResponse {
        let url = baseUrl.appendingPathComponent("config")

        var headers: [String: String] = [
            authorization: "\(bearer) \(apiKey)"
        ]

        if let eTag {
            headers["If-None-Match"] = eTag
        }

        let response = httpClient.sendJsonRequest(
            url: url,
            method: .get,
            headers: headers,
            jsonBody: Data()
        )

        switch response {
        case .success(let body, let newETag):

            guard let body,
                  let data = body.data(using: .utf8) else {
                return .error
            }

            do {
                let decoder = JSONDecoder()
                let config = try decoder.decode(BaseDynamicConfig.self, from: data)

                // default 5 minutes if backend forgets
                let cacheControl = 300

                return .success(
                    config: config,
                    eTag: newETag,
                    cacheControl: Number(cacheControl)
                )
            } catch {
                return .error
            }

        case .error(let error):

            if case .clientError(let code, _) = error, code == 304 {
                return .notModified
            }

            return .error
        }
    }

    private func buildBatchPayload(events: [Data], spans: [Data]) -> Data {
        let payloadSize = (events + spans).reduce(0) { $0 + $1.count + 1 }

        var jsonBody = Data(capacity: payloadSize + 32)
        jsonBody.append(contentsOf: "{\"events\":".utf8)
        JSONWriter.appendArray(of: events, to: &jsonBody)
        jsonBody.append(contentsOf: ",\"spans\":".utf8)
        JSONWriter.appendArray(of: spans, to: &jsonBody)
        jsonBody.append(contentsOf: "}".utf8)

        return jsonBody
    }
}
