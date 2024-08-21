//
//  Measure.swift
//  Measure
//
//  Created by Adwin Ross on 12/08/24.
//

import Foundation

@objc public class Measure: NSObject {
    private override init() {}
    
    @objc public static func start() {
        CrashReportManager.shared.start(with: UUID().uuidString)
    }
}
