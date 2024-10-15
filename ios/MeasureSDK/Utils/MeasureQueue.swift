//
//  MeasureQueue.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 23/09/24.
//

import Foundation

struct MeasureQueue {
    static let background: DispatchQueue = {
        let queue = DispatchQueue(label: backgroundQueueLabel, qos: .background)
        return queue
    }()

    static let userInitiated: DispatchQueue = {
        let queue = DispatchQueue(label: userInitiatedQueueLabel, qos: .userInitiated)
        return queue
    }()
}
