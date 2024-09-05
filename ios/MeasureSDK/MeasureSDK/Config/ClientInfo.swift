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
@objc public final class ClientInfo: NSObject, Client {
    let apiKey: String
    let apiUrl: URL

    /// Client info
    /// - Parameters:
    ///   - apiKey: `API Key` from the Measure dashboard.
    ///   - apiUrl: `API URL` from the Measure dashboard.
    @objc public init(apiKey: String,
                      apiUrl: String) {
        guard !apiKey.isEmpty else {
            fatalError("apiKey cannot be empty.")
        }
        guard let apiUrl = URL(string: apiUrl) else {
            fatalError("Invalid apiUrl: \(apiUrl).")
        }

        self.apiKey = apiKey
        self.apiUrl = apiUrl
    }
}
