//
//  BatchEntity.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 17/10/24.
//

import Foundation

struct BatchEntity {
    let batchId: String
    let eventIds: [String]
    let spanIds: [String]
    let createdAt: Int64
}
