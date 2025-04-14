//
//  AtomicBool.swift
//  Measure
//
//  Created by Adwin Ross on 01/04/25.
//

import Foundation

/// A thread-safe wrapper around a Boolean value, providing conditional atomic transitions
/// that allow executing closures when the internal value changes.
final class AtomicBool {
    private var value: Bool
    private let lock = NSLock()

    /// Creates an atomic boolean with an initial value.
    ///
    /// - Parameter initialValue: The initial boolean value. Defaults to `false`.
    init(_ initialValue: Bool = false) {
        self.value = initialValue
    }

    /// Atomically sets the value to `true` if it is currently `false` and executes the given closure.
    ///
    /// - Parameter action: The closure to execute only if the value was changed from `false` to `true`.
    func setTrueIfFalse(then action: () -> Void) {
        lock.lock()
        defer { lock.unlock() }

        if !value {
            value = true
            action()
        }
    }

    /// Atomically sets the value to `false` if it is currently `true` and executes the given closure.
    ///
    /// - Parameter action: The closure to execute only if the value was changed from `true` to `false`.
    func setFalseIfTrue(then action: () -> Void) {
        lock.lock()
        defer { lock.unlock() }

        if value {
            value = false
            action()
        }
    }

    /// Atomically sets the internal value.
    ///
    /// - Parameter newValue: The new value to set.
    func set(_ newValue: Bool) {
        lock.lock()
        defer { lock.unlock() }
        value = newValue
    }

    /// Returns the current value in a thread-safe manner.
    ///
    /// - Returns: The current value of the atomic boolean.
    func get() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return value
    }

    /// Executes the provided closure with the internal value in a thread-safe context.
    ///
    /// - Parameter action: A closure that receives the current value.
    func withValue(_ action: (Bool) -> Void) {
        lock.lock()
        defer { lock.unlock() }
        action(value)
    }
}
