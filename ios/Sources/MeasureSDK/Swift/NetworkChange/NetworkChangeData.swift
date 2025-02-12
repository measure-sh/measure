//
//  NetworkChangeData.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/12/24.
//

import Foundation

/// Represents the data related to network changes.
class NetworkChangeData: Codable {
    /// The [NetworkType] of the network that was previously active. This is null if there was no previously active network.
    let previousNetworkType: NetworkType

    /// The [NetworkType] of the network that is now active.
    let networkType: NetworkType

    /// The [NetworkGeneration] of the network that was previously active. Only set for cellular networks.
    let previousNetworkGeneration: NetworkGeneration

    /// The [NetworkGeneration] of the network that is now active.
    let networkGeneration: NetworkGeneration

    /// The name of the network provider that is now active. Only set for cellular networks.
    let networkProvider: String

    /// Coding keys to map snake_case JSON keys to camelCase properties.
    private enum CodingKeys: String, CodingKey {
        case previousNetworkType = "previous_network_type"
        case networkType = "network_type"
        case previousNetworkGeneration = "previous_network_generation"
        case networkGeneration = "network_generation"
        case networkProvider = "network_provider"
    }

    init(previousNetworkType: NetworkType, networkType: NetworkType, previousNetworkGeneration: NetworkGeneration, networkGeneration: NetworkGeneration, networkProvider: String) {
        self.previousNetworkType = previousNetworkType
        self.networkType = networkType
        self.previousNetworkGeneration = previousNetworkGeneration
        self.networkGeneration = networkGeneration
        self.networkProvider = networkProvider
    }
}
