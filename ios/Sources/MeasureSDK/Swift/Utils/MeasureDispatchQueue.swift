//
//  MeasureDispatchQueue.swift
//  Measure
//
//  Created by Adwin Ross on 26/06/25.
//

import Foundation

protocol MeasureDispatchQueue {
    func submit(_ block: @escaping () -> Void)
    func schedule(after delay: TimeInterval, _ block: @escaping () -> Void)
}

final class BaseMeasureDispatchQueue: MeasureDispatchQueue {
    private let queue: DispatchQueue
    private var timer: DispatchSourceTimer?

    init(label: String = "com.measure.executor", qos: DispatchQoS = .background) {
        self.queue = DispatchQueue(label: label, qos: qos)
    }

    func submit(_ block: @escaping () -> Void) {
        queue.async(execute: block)
    }

    func schedule(after delay: TimeInterval, _ block: @escaping () -> Void) {
        queue.asyncAfter(deadline: .now() + delay, execute: block)
    }

}
