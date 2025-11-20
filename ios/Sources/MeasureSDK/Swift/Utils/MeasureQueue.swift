//
//  MeasureQueue.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 23/09/24.
//

import Foundation

struct MeasureQueue {
    static let periodicEventExporter: DispatchQueue = {
        let queue = DispatchQueue(label: "sh.measure.periodic.event.exporter", qos: .background)
        return queue
    }()

    static let attachmentExporter: DispatchQueue = {
        let queue = DispatchQueue(label: "sh.measure.attachment.exporter", qos: .utility)
        return queue
    }()
}
