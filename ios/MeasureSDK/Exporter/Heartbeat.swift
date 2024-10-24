//
//  Heartbeat.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 16/10/24.
//

import Foundation

protocol HeartbeatListener: AnyObject {
    func pulse()
}

protocol Heartbeat {
    func start(intervalMs: Number, initialDelayMs: Number)
    func stop()
    func addListener(_ listener: HeartbeatListener)
}

/// Schedules a periodic pulse.
final class BaseHeartbeat: Heartbeat {
    private var timer: Timer?
    private var listeners: [HeartbeatListener] = []

    func addListener(_ listener: HeartbeatListener) {
        listeners.append(listener)
    }

    func start(intervalMs: Number, initialDelayMs: Number = 0) {
        guard timer == nil else { return }

        timer = Timer.scheduledTimer(withTimeInterval: TimeInterval(intervalMs) / 1000.0,
                                     repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.listeners.forEach { $0.pulse() }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(Int(initialDelayMs))) { [weak self] in
            guard let timer = self?.timer else { return }
            timer.fire()
        }
    }

    func stop() {
        if timer != nil {
            timer?.invalidate()
            timer = nil
        }
    }
}
