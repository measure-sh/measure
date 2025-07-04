//
//  ClientInfo.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 27/08/24.
//

import Foundation

/// Client Info identifiers for the Measure SDK.
protocol Client {
    var apiKey: String { get }
    var apiUrl: URL { get }
}

/// Client Info identifiers for the Measure SDK.
///
/// Properties:
/// - `apiKey`: `API Key` from the Measure dashboard.
/// - `apiUrl`: `API URL` from the Measure dashboard.
///
@objc public final class ClientInfo: NSObject, Client, Codable {
    let apiKey: String
    let apiUrl: URL

    /// Client info
    /// - Parameters:
    ///   - apiKey: `API Key` from the Measure dashboard.
    ///   - apiUrl: `API URL` from the Measure dashboard.
    @objc public init(apiKey: String,
                      apiUrl: String) {
        if apiKey.isEmpty {
            debugPrint("Measure apiKey is missing, skipping initialization.")
        }
        if let apiUrl = URL(string: apiUrl) {
            self.apiUrl = apiUrl
        } else {
            self.apiUrl = URL(string: fallbackApiUrl)!
            debugPrint("Measure apiUrl is invalid, skipping initialization.")
        }

        self.apiKey = apiKey
    }

    public required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.apiKey = try container.decode(String.self, forKey: .apiKey)
        let apiUrlString = try container.decode(String.self, forKey: .apiUrl)
        if let url = URL(string: apiUrlString) {
            self.apiUrl = url
        } else {
            self.apiUrl = URL(string: fallbackApiUrl)!
        }
    }
}
