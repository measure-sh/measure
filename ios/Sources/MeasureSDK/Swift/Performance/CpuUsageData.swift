//
//  CpuUsageData.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 04/11/24.
//

import Foundation

struct CpuUsageData: Codable {
    let numCores: UInt8
    let clockSpeed: UInt64
    let startTime: Number
    let uptime: Number
    let utime: Number
    let cutime: Number
    let cstime: Number
    let stime: Number
    let interval: UnsignedNumber
    let percentageUsage: FloatNumber64

    enum CodingKeys: String, CodingKey {
        case numCores = "num_cores"
        case clockSpeed = "clock_speed"
        case startTime = "start_time"
        case uptime
        case utime
        case cutime
        case cstime
        case stime
        case interval
        case percentageUsage = "percentage_usage"
    }
}
