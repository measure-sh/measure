//
//  Measure.swift
//  Measure
//
//  Created by Adwin Ross on 12/08/24.
//

import Foundation

/// `Measure` is a singleton class responsible for managing the initialization and configuration of the Measure SDK.
///
/// The `Measure` class provides a shared instance that is used to initialize and configure the SDK.
/// This class ensures that the SDK is initialized only once, and offers thread-safe access to the shared instance.
///
/// - Note: It is recommended to initialize the SDK as early as possible during the application startup to ensure
/// that exceptions and other events are captured promptly.
///
@objc public final class Measure: NSObject {
    /// The shared instance of `Measure`.
    ///
    /// Use this property to access the singleton instance of the `Measure` class. The shared instance is lazily
    /// instantiated the first time it is accessed, ensuring that the SDK is initialized only once.
    ///
    /// - Example:
    ///   - Swift:
    ///   ```swift
    ///   let clientInfo = ClientInfo(apiKey: "apiKey", apiUrl: "apiUrl")
    ///   Measure.shared.initialize(with: clientInfo)
    ///   ```
    ///   - Objective-C:
    ///   ```objc
    ///   [[Measure shared] initializeWith:clientInfo config:config];
    ///   ```
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
    ///
    /// It is recommended to initialize the SDK as early as possible in the application startup so that exceptions and other events can be captured as early as possible.
    ///
    /// An optional `MeasureConfig` can be passed to configure the SDK. If not provided, the SDK will use the default configuration.
    ///
    /// Initializing the SDK multiple times will have no effect.
    /// - Parameter config: The configuration for the Measure SDK.
    /// - Parameter client: `ClientInfo` object consisting the api-key and api-url
    ///
    /// - Example:
    ///   - Swift:
    ///   ```swift
    ///   let config = BaseMeasureConfig()
    ///   let clientInfo = ClientInfo(apiKey: "<apiKey>", apiUrl: "<apiUrl>")
    ///   Measure.shared.initialize(with: clientInfo, config: config)
    ///   ```
    ///   - Objective-C:
    ///   ```objc
    ///   BaseMeasureConfig *config = [[BaseMeasureConfig alloc] init];
    ///   ClientInfo *clientInfo = [[ClientInfo alloc] initWithApiKey:@"<apiKey>" apiUrl:@"<apiUrl>"];
    ///   [[Measure shared] initializeWith:clientInfo config:config];
    ///   ```
    @objc public func initialize(with client: ClientInfo, config: BaseMeasureConfig? = nil) {
        MeasureQueue.userInitiated.sync {
            // Ensure initialization is done only once
            guard measure == nil else { return }
            SignPost.trace(label: "Measure Initialisation") {
                let initializer = BaseMeasureInitializer(config: config ?? BaseMeasureConfig(),
                                                         client: client)
                measure = MeasureInternal(initializer)
            }
        }
    }
}
