//
//  RecentSession.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/10/24.
//

import Foundation

struct RecentSession {
    let id: String
    let createdAt: Int64
    var lastEventTime: Int64
    var crashed: Bool
    let versionCode: String

    init(id: String,
         createdAt: Int64,
         lastEventTime: Int64 = 0,
         crashed: Bool = false,
         versionCode: String) {
        self.id = id
        self.createdAt = createdAt
        self.lastEventTime = lastEventTime
        self.crashed = crashed
        self.versionCode = versionCode
    }

    func hasTrackedEvent() -> Bool {
        return lastEventTime != 0
    }
}
