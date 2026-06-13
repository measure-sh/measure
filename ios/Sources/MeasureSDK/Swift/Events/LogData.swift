//
//  LogData.swift
//  Measure
//
//  Created by Abhay Sood on 11/06/26.
//

import Foundation

struct LogData: Codable {
    let severityText: String
    let severityNumber: Int
    let body: String

    enum CodingKeys: String, CodingKey {
        case severityText = "severity_text"
        case severityNumber = "severity_number"
        case body
    }
}
