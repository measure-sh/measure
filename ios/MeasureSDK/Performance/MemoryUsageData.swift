//
//  MemoryUsageData.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 09/11/24.
//

import Foundation

struct MemoryUsageData: Codable {
    let maxMemory: UnsignedNumber
    let usedMemory: UnsignedNumber
    let interval: UnsignedNumber

    enum CodingKeys: String, CodingKey {
        case maxMemory = "max_memory"
        case usedMemory = "used_memory"
        case interval
    }
}
