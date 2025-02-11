//
//  SessionEntity.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 22/09/24.
//

import Foundation

struct SessionEntity: Codable {
    let sessionId: String
    let pid: Int32
    let createdAt: Number
    let needsReporting: Bool
    let crashed: Bool

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case pid
        case createdAt = "created_at"
        case needsReporting = "needs_reporting"
        case crashed
    }
}
