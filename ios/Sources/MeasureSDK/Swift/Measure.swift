//
//  Measure.swift
//  Measure
//
//  Created by Adwin Ross on 12/08/24.
//

import Foundation
import UIKit

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
    private var measureInitializerLock = NSLock()
    private var measureLifecycleLock = NSLock()
    private var measureInternal: MeasureInternal?
    var meaureInitializerInternal: MeasureInitializer?
//    private var floatingButtonController: FloatingButtonController?

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
        measureInitializerLock.lock()
        defer { measureInitializerLock.unlock() }

        // Ensure initialization is done only once
        guard measureInternal == nil else { return }

        SignPost.trace(subcategory: "MeasureLifecycle", label: "measureInitialisation") {
            if let meaureInitializer = self.meaureInitializerInternal {
                measureInternal = MeasureInternal(meaureInitializer)
                meaureInitializer.logger.log(level: .info, message: "SDK enabled in testing mode.", error: nil, data: nil)
            } else {
                if !client.apiKey.isEmpty && client.apiUrl.absoluteString != fallbackApiUrl {
                    let meaureInitializer = BaseMeasureInitializer(config: config ?? BaseMeasureConfig(),
                                                                   client: client)
                    measureInternal = MeasureInternal(meaureInitializer)
                } else {
                    debugPrint("Skipping SDK initialization: Missing or invalid API key or API URL")
                }
            }
        }
    }

    /// Returns the session ID for the current session, or nil if the SDK has not been initialized.
    ///
    /// A session represents a continuous period of activity in the app. A new session begins when the app is launched for the first time, or when there's been no activity for a 20-minute period.
    /// A single session can continue across multiple app background and foreground events; brief interruptions will not cause a new session to be created.
    /// - Returns: The session ID if the SDK is initialized, or nil otherwise.
    @objc public func getSessionId() -> String? {
        guard let sessionId = measureInternal?.sessionManager.sessionId else { return nil }

        return sessionId
    }

    /// Starts tracking.
    ///
    /// - SeeAlso: `stop()` to stop tracking.
    /// - SeeAlso: `MeasureConfig.autoStart` to control whether the SDK should start on initialization.
    ///
    /// - Example:
    ///   - Swift:
    ///   ```swift
    ///   Measure.shared.start()
    ///   ```
    ///   - Objective-C:
    ///   ```objc
    ///   [[Measure shared] start];
    ///   ```
    @objc public func start() {
        SignPost.trace(subcategory: "MeasureLifecycle", label: "measureStart") {
            measureLifecycleLock.lock()
            defer { measureLifecycleLock.unlock() }
            
            guard let measureInternal = self.measureInternal else { return }
            measureInternal.start()
        }
    }

    /// Stops tracking.
    ///
    /// - SeeAlso: `start()` to resume tracking.
    /// - SeeAlso: `MeasureConfig.autoStart` to control whether the SDK should start on initialization.
    ///
    /// - Example:
    ///   - Swift:
    ///   ```swift
    ///   Measure.shared.stop()
    ///   ```
    ///   - Objective-C:
    ///   ```objc
    ///   [[Measure shared] stop];
    ///   ```
    @objc public func stop() {
        SignPost.trace(subcategory: "MeasureLifecycle", label: "measureStop") {
            measureLifecycleLock.lock()
            defer { measureLifecycleLock.unlock() }
            
            guard let measureInternal = self.measureInternal else { return }
            measureInternal.stop()
        }
    }

    /// Tracks an event with optional timestamp.
    /// Event names should be clear and consistent to aid in dashboard searches
    ///
    ///   ```swift
    ///   Measure.shared.trackEvent(name: "event-name", attributes:["user_name": .string("Alice")], timestamp: nil)
    ///   ```
    /// - Parameters:
    ///   - name: Name of the event (max 64 characters)
    ///   - attributes: Key-value pairs providing additional context
    ///   - timestamp: Optional timestamp for the event, defaults to current time
    ///
    public func trackEvent(name: String, attributes: [String: AttributeValue], timestamp: Int64?) {
        guard let measureInternal = measureInternal else { return }

        measureInternal.trackEvent(name: name, attributes: attributes, timestamp: timestamp)
    }

    /// An internal method to track events from cross-platform frameworks
    /// like Flutter and React Native.
    ///
    /// This method is not intended for public usage and can change in future versions. To
    /// track events use trackEvent.
    ///
    /// Usage Notes:
    /// * data is a "mutable" map as certain data may be added by the native SDK. For
    ///   example, for an exception event the foreground property is set by the native SDK.
    /// * attributes set from cross-platform frameworks may be overridden by the native SDK. To
    ///   prevent this modify the SignalProcessor.
    ///
    /// - Parameters:
    ///   - data: The event data compatible for the given event type.
    ///   - type: The event type, must be one of EventType.
    ///   - timestamp: The event timestamp in milliseconds since epoch.
    ///   - attributes: Key-value pairs providing additional context to the event. Must be one of
    ///     ShMeasureIOSAttributes.Attribute.
    ///   - userDefinedAttrs: Custom key-value pairs providing additional context to the event.
    ///   - attachments: List of attachments to be sent with the event.
    ///   - userTriggered: Whether the event was triggered by the user.
    ///   - sessionId: Optional session ID associated with the event. By default the event will
    ///     be associated with the current session ID.
    ///   - threadName: Optional thread name associated with the event. By default the event
    ///     will be associated with the thread on which this function is processed.
    public func internalTrackEvent(data: inout [String: Any?], // swiftlint:disable:this function_parameter_count
                                   type: String,
                                   timestamp: Int64,
                                   attributes: [String: Any?],
                                   userDefinedAttrs: [String: AttributeValue],
                                   userTriggered: Bool,
                                   sessionId: String?,
                                   threadName: String?) {
        guard let internalEventCollector = measureInternal?.internalSignalCollector else { return }
        internalEventCollector.trackEvent(data: &data,
                                          type: type,
                                          timestamp: timestamp,
                                          attributes: attributes,
                                          userDefinedAttrs: userDefinedAttrs,
                                          userTriggered: userTriggered,
                                          sessionId: sessionId,
                                          threadName: threadName)
    }

    /// Tracks an event with optional timestamp.
    /// Event names should be clear and consistent to aid in dashboard searches
    ///
    /// Note:
    /// This method is primarily intended for Objective-C use.
    ///
    ///   ```objc
    ///   [[Measure shared] trackEvent:@"event-name" attributes:@{@"user_name": @"Alice"} timestamp:nil];
    ///   ```
    /// - Parameters:
    ///   - name: Name of the event (max 64 characters)
    ///   - attributes: Key-value pairs providing additional context
    ///   - timestamp: Optional timestamp for the event, defaults to current time
    @objc public func trackEvent(_ name: String, attributes: [String: Any], timestamp: NSNumber?) {
        guard let measureInternal = measureInternal else { return }

        measureInternal.trackEvent(name, attributes: attributes, timestamp: timestamp)
    }

    /// Call when a screen is viewed by the user.
    ///
    /// Measure SDK automatically collects screen view events for UIKit and SwiftUI navigation.
    /// However, if your app uses a custom navigation system, you can use this method to track
    /// screen view events and gain more context when debugging issues.
    ///
    /// Example usage:
    /// ```swift
    /// Measure.shared.trackScreenView("Home")
    /// ```
    ///
    /// ```objc
    /// [[Measure shared] trackScreenView:@"ObjcViewController"]
    /// ```
    @objc public func trackScreenView(_ screenName: String) {
        guard let userTriggeredEventCollector = measureInternal?.userTriggeredEventCollector else { return }

        userTriggeredEventCollector.trackScreenView(screenName)
    }

    /// Sets the user ID for the current user.
    ///
    /// User ID is persisted across app launches and is used to identify the user across sessions.
    ///
    /// It is recommended to avoid the use of PII (Personally Identifiable Information) in the
    /// user ID, such as email, phone number, or any other sensitive information. Instead, use a hashed
    /// or anonymized user ID to protect user privacy.
    ///
    /// Example usage:
    /// ```swift
    /// Measure.shared.setUserId("user_id")
    /// ```
    ///
    /// ```objc
    /// [[Measure shared] setUserId:@"user_id"]
    /// ```
    ///
    /// - Parameter userId: userId string.
    @objc public func setUserId(_ userId: String) {
        guard let measureInternal = measureInternal else { return }
        measureInternal.setUserId(userId)
    }

    /// Clears the user ID, if previously set by `setUserId`.
    ///
    /// Example usage:
    /// ```swift
    /// Measure.shared.clearUserId()
    /// ```
    ///
    /// ```objc
    /// [[Measure shared] clearUserId]
    /// ```
    @objc public func clearUserId() {
        guard let measureInternal = measureInternal else { return }
        measureInternal.clearUserId()
    }

    /// Returns the current time in milliseconds since epoch.
    /// - Returns: The current time in milliseconds since epoch.
    @objc public func getCurrentTime() -> Int64 {
        guard let measureInternal = self.measureInternal else { return 0 }
        return measureInternal.timeProvider.now()
    }

    /// Starts a new performance tracing span with the specified name.
    /// - Parameter name: The name to identify this span. Follow the naming convention guide for consistent naming practices.
    /// - Returns: A new span instance if the SDK is initialized, or an invalid no-op span if not initialized
    public func startSpan(name: String) -> Span {
        guard let measureInternal = self.measureInternal else { return InvalidSpan() }
        return measureInternal.startSpan(name: name)
    }

    /// Starts a new performance tracing span with the specified name and start timestamp.
    /// - Parameters:
    ///   - name: The name to identify this span. Follow the naming convention guide for consistent naming practices.
    ///   - timestamp: The milliseconds since epoch when the span started. Must be obtained using `getCurrentTime()` to minimize clock drift effects.
    /// - Returns: A new span instance if the SDK is initialized, or an invalid no-op span if not initialized
    ///
    /// Note: Use this method when you need to trace an operation that has already started and you have
    /// captured its start time using `getCurrentTime()`.
    public func startSpan(name: String, timestamp: Int64) -> Span {
        guard let measureInternal = self.measureInternal else { return InvalidSpan() }
        return measureInternal.startSpan(name: name, timestamp: timestamp)
    }

    /// Creates a configurable span builder for deferred span creation.
    /// - Parameter name: The name to identify this span. Follow the naming convention guide for consistent naming practices.
    /// - Returns: A builder instance to configure the span if the SDK is initialized, or nil if the SDK is not initialized
    ///
    /// Note: Use this method when you need to create a span without immediately starting it.
    public func createSpanBuilder(name: String) -> SpanBuilder? {
        guard let measureInternal = self.measureInternal else { return nil }
        return measureInternal.createSpan(name: name)
    }

    /// Returns the W3C traceparent header value for the given span.
    /// - Parameter span: The span to extract the traceparent header value from
    /// - Returns: A W3C trace context compliant header value in the format: `{version}-{traceId}-{spanId}-{traceFlags}`
    ///
    /// Example: `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`
    ///
    /// Note: Use this value in the `traceparent` HTTP header when making API calls to enable
    /// distributed tracing between your mobile app and backend services.
    public func getTraceParentHeaderValue(span: Span) -> String {
        guard let measureInternal = self.measureInternal else { return "" }
        return measureInternal.getTraceParentHeaderValue(for: span)
    }

    /// Returns the W3C traceparent header key/name.
    /// - Returns: The standardized header key 'traceparent' that should be used when adding
    /// distributed tracing context to HTTP requests
    public func getTraceParentHeaderKey() -> String {
        guard let measureInternal = self.measureInternal else { return "" }
        return measureInternal.getTraceParentHeaderKey()
    }

    /// Takes a screenshot and launches the bug report flow.
    /// - Parameters:
    ///   - takeScreenshot: Set to `false` to disable the screenshot. Defaults to `true`.
    ///   - bugReportConfig: A configuration object used to customize the appearance and behavior of the bug report UI.
    ///   - attributes: Optional key-value pairs for additional metadata about the bug report.
    public func launchBugReport(takeScreenshot: Bool = true,
                                bugReportConfig: BugReportConfig = .default,
                                attributes: [String: AttributeValue]? = nil) {
        guard let measureInternal = self.measureInternal else { return }
        measureInternal.startBugReportFlow(takeScreenshot: takeScreenshot, bugReportConfig: bugReportConfig, attributes: attributes)
    }

    /// Takes a screenshot and launches the bug report flow.
    ///
    /// Note:
    /// This method is primarily intended for Objective-C use.
    ///
    /// - Parameters:
    ///   - takeScreenshot: Set to `false` to disable the screenshot. Defaults to `true`.
    ///   - bugReportConfig: A configuration object used to customize the appearance and behavior of the bug report UI.
    ///   - attributes: Optional key-value pairs for additional metadata about the bug report.
    @objc public func launchBugReport(takeScreenshot: Bool = true,
                                      bugReportConfig: BugReportConfig = .default,
                                      attributes: [String: Any]? = nil) {
        guard let measureInternal = self.measureInternal else { return }
        measureInternal.startBugReportFlow(takeScreenshot: takeScreenshot, bugReportConfig: bugReportConfig, attributes: attributes)
    }

    /// Enables automatic bug reporting using shake detection.
    /// When the device is shaken, this will automatically launch the built-in bug report UI.
    ///
    /// - Parameter takeScreenshot: Set to `true` to include a screenshot with the report (default is `true`).
    /// - SeeAlso: `disableShakeToLaunchBugReport()`
    @objc public func enableShakeToLaunchBugReport(takeScreenshot: Bool = true) {
        guard let measureInternal = self.measureInternal else { return }
        measureInternal.enableShakeToLaunchBugReport(takeScreenshot: takeScreenshot)
    }

    /// Disables automatic bug reporting triggered by shaking the device.
    /// After calling this method, shake gestures will no longer open the bug report screen.
    ///
    /// - SeeAlso: `enableShakeToLaunchBugReport(takeScreenshot:)`
    @objc public func disableShakeToLaunchBugReport() {
        guard let measureInternal = self.measureInternal else { return }
        measureInternal.disableShakeToLaunchBugReport()
    }

    /// Checks whether the shake-to-launch bug report feature is currently enabled.
    ///
    /// - Returns: `true` if shake detection is active and will launch the bug report UI, otherwise `false`.
    @objc public func isShakeToLaunchBugReportEnabled() -> Bool {
        guard let measureInternal = self.measureInternal else { return false }
        return measureInternal.isShakeToLaunchBugReportEnabled()
    }

    /// Sets a custom shake listener for manually handling shake gestures.
    /// This is useful for showing a confirmation UI or triggering a custom bug reporting flow instead of
    /// launching the built-in experience.
    ///
    /// Key behavior:
    /// - Setting a non-`nil` listener enables shake detection.
    /// - Setting `nil` disables shake detection.
    /// - The listener is throttled and will only fire once every 5 seconds.
    /// - Has no effect if automatic shake reporting is already enabled.
    ///
    /// - Parameter listener: A custom `MsrShakeListener` to receive shake callbacks, or `nil` to disable.
    @objc public func setShakeListener(_ listener: MsrShakeListener?) {
        guard let measureInternal = self.measureInternal else { return }
        measureInternal.setShakeListener(listener)
    }

    /// Tracks a custom bug report.
    ///
    /// For a pre-built UI experience to collect bug reports, see `launchBugReportActivity()`.
    /// Attachments can contain screenshots, layout snapshots or images from the gallery.
    ///
    /// - Parameters:
    ///   - description: Description of the bug. Max characters: 4000.
    ///   - attachments: Optional list of attachments. Max: 5.
    ///   - attributes: Optional key-value pairs for additional metadata about the bug report.
    public func trackBugReport(description: String,
                               attachments: [MsrAttachment] = [],
                               attributes: [String: AttributeValue]? = nil) {
        guard let measureInternal = self.measureInternal else { return }
        measureInternal.trackBugReport(description: description, attachments: attachments, attributes: attributes)
    }

    /// Tracks a custom bug report
    ///
    /// For a pre-built UI experience to collect bug reports, see `launchBugReportActivity()`.
    /// Attachments can contain screenshots, layout snapshots or images from the gallery.
    ///
    /// Note:
    /// This method is primarily intended for Objective-C use.
    ///
    /// - Parameters:
    ///   - description: Description of the bug. Max characters: 4000.
    ///   - attachments: Optional list of attachments. Max: 5.
    ///   - attributes: Optional key-value pairs for additional metadata about the bug report.
    @objc public func trackBugReport(description: String,
                                     attachments: [MsrAttachment] = [],
                                     attributes: [String: Any]? = nil) {
        guard let measureInternal = self.measureInternal else { return }
        measureInternal.trackBugReport(description: description, attachments: attachments, attributes: attributes)
    }

    /// Captures a screenshot of the specified view controller's window.
    ///
    /// This method **must** be called from the main thread. The screenshot is redacted based on the privacy level
    /// specified in the `MeasureConfig.screenshotMaskLevel`. By default, all text and media are masked to protect sensitive content.
    ///
    /// The screenshot is captured asynchronously and returned via the completion handler.
    ///
    /// - Parameters:
    ///   - viewController: The view controller whose view hierarchy will be captured.
    ///   - completion: A closure that returns an optional `MsrAttachment` containing the redacted screenshot data. Returns `nil` if the capture fails.
    @objc public func captureScreenshot(for viewController: UIViewController, completion: @escaping (MsrAttachment?) -> Void) {
        guard let measureInternal = self.measureInternal else {
            completion(nil)
            return
        }
        measureInternal.captureScreenshot(for: viewController) { msrAttachment in
            completion(msrAttachment)
        }
    }

    /// Asynchronously captures a layout snapshot of the given view controller's view hierarchy.
    /// This method must be called on the main thread.
    ///
    /// The snapshot includes information about the visible UI elements such as their position,
    /// size, and hierarchy. Unlike full screenshots, layout snapshots are lightweight and more
    /// storage-efficient, making them ideal for debugging and UI analysis.
    ///
    /// - Important: This method must be invoked from the main thread to avoid UI inconsistencies.
    ///
    /// - Parameters:
    ///   - viewController: The `UIViewController` whose layout should be captured.
    ///   - completion: A closure called with an optional `MsrAttachment` containing the layout snapshot data.
    @objc public func captureLayoutSnapshot(for viewController: UIViewController, completion: @escaping (MsrAttachment?) -> Void) {
        guard let measureInternal = self.measureInternal else {
            completion(nil)
            return
        }

        measureInternal.captureLayoutSnapshot(for: viewController) { msrAttachment in
            completion(msrAttachment)
        }
    }
}
