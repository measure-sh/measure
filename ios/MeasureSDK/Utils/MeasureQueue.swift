//
//  MeasureQueue.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 23/09/24.
//

import Foundation

struct MeasureQueue {
    static let periodicEventExporter: DispatchQueue = {
        let queue = DispatchQueue(label: periodicEventExporterLabel, qos: .background)
        return queue
    }()

    static let userInitiated: DispatchQueue = {
        let queue = DispatchQueue(label: userInitiatedQueueLabel, qos: .userInitiated)
        return queue
    }()
}
