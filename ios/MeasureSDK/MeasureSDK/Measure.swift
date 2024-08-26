//
//  Measure.swift
//  Measure
//
//  Created by Adwin Ross on 12/08/24.
//

import Foundation

@objc public class Measure: NSObject {
    @objc public static let shared: Measure = {
        let instance = Measure()
        return instance
    }()
    private var measure: MeasureInternal?

    // Private initializer to ensure the singleton pattern
    private override init() {
        super.init()
    }

    /// Initializes the Measure SDK. The SDK must be initialized before using any of the other methods. 
    /// It is recommended to initialize the SDK as early as possible in the application startup so that exceptions and other events can be captured as early as possible. 
    /// An optional `MeasureConfig` can be passed to configure the SDK. If not provided, the SDK will use the default configuration.
    ///
    /// Initializing the SDK multiple times will have no effect.
    /// - Parameter config: The configuration for the Measure SDK.
    @objc public func initialize(with config: MeasureConfig = MeasureConfig()) {
        // Ensure initialization is done only once
        guard measure == nil else { return }

        let initializer = MeasureInitializer(config)
        measure = MeasureInternal(initializer)
    }
}
