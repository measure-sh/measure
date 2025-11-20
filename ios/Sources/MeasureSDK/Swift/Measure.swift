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
    @objc static let shared: Measure = {
        let instance = Measure()
        return instance
    }()
    private var measureInitializerLock = NSLock()
    private var measureLifecycleLock = NSLock()
    private var measureInternal: MeasureInternal?
    var meaureInitializerInternal: MeasureInitializer?

    // Private initializer to ensure the singleton pattern
    private override init() {
        super.init()
    }

    @objc func initialize(with client: ClientInfo, config: BaseMeasureConfig? = nil) {
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

    @objc func getSessionId() -> String? {
        guard let sessionId = measureInternal?.sessionManager.sessionId else { return nil }

        return sessionId
    }

    @objc func start() {
        SignPost.trace(subcategory: "MeasureLifecycle", label: "measureStart") {
            measureLifecycleLock.lock()
            defer { measureLifecycleLock.unlock() }

            guard let measureInternal = self.measureInternal else { return }
            measureInternal.start()
        }
    }

    @objc func stop() {
        SignPost.trace(subcategory: "MeasureLifecycle", label: "measureStop") {
            measureLifecycleLock.lock()
            defer { measureLifecycleLock.unlock() }

            guard let measureInternal = self.measureInternal else { return }
            measureInternal.stop()
        }
    }

    func trackEvent(name: String, attributes: [String: AttributeValue], timestamp: Int64?) {
        guard let measureInternal = measureInternal else { return }

        measureInternal.trackEvent(name: name, attributes: attributes, timestamp: timestamp)
    }

    func internalTrackEvent(data: inout [String: Any?], // swiftlint:disable:this function_parameter_count
                            type: String,
                            timestamp: Int64,
                            attributes: [String: Any?],
                            userDefinedAttrs: [String: AttributeValue],
                            userTriggered: Bool,
                            sessionId: String?,
                            threadName: String?,
                            attachments: [MsrAttachment]) {
        guard let internalEventCollector = measureInternal?.internalSignalCollector else { return }
        internalEventCollector.trackEvent(data: &data,
                                          type: type,
                                          timestamp: timestamp,
                                          attributes: attributes,
                                          userDefinedAttrs: userDefinedAttrs,
                                          userTriggered: userTriggered,
                                          sessionId: sessionId,
                                          threadName: threadName,
                                          attachments: attachments)
    }

    func internalTrackSpan(name: String, // swiftlint:disable:this function_parameter_count
                           traceId: String,
                           spanId: String,
                           parentId: String?,
                           startTime: Int64,
                           endTime: Int64,
                           duration: Int64,
                           status: Int64,
                           attributes: [String: Any?],
                           userDefinedAttrs: [String: AttributeValue],
                           checkpoints: [String: Int64],
                           hasEnded: Bool,
                           isSampled: Bool) {
        guard let internalSignalCollector = measureInternal?.internalSignalCollector else { return }
        internalSignalCollector.trackSpan(name: name,
                                          traceId: traceId,
                                          spanId: spanId,
                                          parentId: parentId,
                                          startTime: startTime,
                                          endTime: endTime,
                                          duration: duration,
                                          status: status,
                                          attributes: attributes,
                                          userDefinedAttrs: userDefinedAttrs,
                                          checkpoints: checkpoints,
                                          hasEnded: hasEnded,
                                          isSampled: isSampled)
    }

    @objc func trackEvent(_ name: String, attributes: [String: Any], timestamp: NSNumber?) {
        guard let measureInternal = measureInternal else { return }

        measureInternal.trackEvent(name, attributes: attributes, timestamp: timestamp)
    }

    func trackScreenView(_ screenName: String, attributes: [String: AttributeValue]?) {
        guard let measureInternal = measureInternal else { return }

        measureInternal.trackScreenView(screenName, attributes: attributes)
    }

    @objc func trackScreenView(_ screenName: String, attributes: [String: Any]?) {
        guard let measureInternal = measureInternal else { return }

        measureInternal.trackScreenView(screenName, attributes: attributes)
    }

    @objc func setUserId(_ userId: String) {
        guard let measureInternal = measureInternal else { return }
        measureInternal.setUserId(userId)
    }

    @objc func clearUserId() {
        guard let measureInternal = measureInternal else { return }
        measureInternal.clearUserId()
    }

    @objc func getCurrentTime() -> Int64 {
        guard let measureInternal = self.measureInternal else { return 0 }
        return measureInternal.timeProvider.now()
    }

    func startSpan(name: String) -> Span {
        guard let measureInternal = self.measureInternal else { return InvalidSpan() }
        return measureInternal.startSpan(name: name)
    }

    func startSpan(name: String, timestamp: Int64) -> Span {
        guard let measureInternal = self.measureInternal else { return InvalidSpan() }
        return measureInternal.startSpan(name: name, timestamp: timestamp)
    }

    func createSpanBuilder(name: String) -> SpanBuilder? {
        guard let measureInternal = self.measureInternal else { return nil }
        return measureInternal.createSpan(name: name)
    }

    func getTraceParentHeaderValue(span: Span) -> String {
        guard let measureInternal = self.measureInternal else { return "" }
        return measureInternal.getTraceParentHeaderValue(for: span)
    }

    func getTraceParentHeaderKey() -> String {
        guard let measureInternal = self.measureInternal else { return "" }
        return measureInternal.getTraceParentHeaderKey()
    }

    func launchBugReport(takeScreenshot: Bool = true,
                         bugReportConfig: BugReportConfig = .default,
                         attributes: [String: AttributeValue]? = nil) {
        guard let measureInternal = self.measureInternal else { return }
        measureInternal.startBugReportFlow(takeScreenshot: takeScreenshot, bugReportConfig: bugReportConfig, attributes: attributes)
    }

    @objc func launchBugReport(takeScreenshot: Bool = true,
                               bugReportConfig: BugReportConfig = .default,
                               attributes: [String: Any]? = nil) {
        guard let measureInternal = self.measureInternal else { return }
        measureInternal.startBugReportFlow(takeScreenshot: takeScreenshot, bugReportConfig: bugReportConfig, attributes: attributes)
    }

    @objc func onShake(_ handler: (() -> Void)?) {
        guard let measureInternal = self.measureInternal else { return }
        measureInternal.onShake(handler)
    }

    func trackBugReport(description: String,
                        attachments: [MsrAttachment] = [],
                        attributes: [String: AttributeValue]? = nil) {
        guard let measureInternal = self.measureInternal else { return }
        measureInternal.trackBugReport(description: description, attachments: attachments, attributes: attributes)
    }

    @objc func trackBugReport(description: String,
                              attachments: [MsrAttachment] = [],
                              attributes: [String: Any]? = nil) {
        guard let measureInternal = self.measureInternal else { return }
        measureInternal.trackBugReport(description: description, attachments: attachments, attributes: attributes)
    }

    @objc func captureScreenshot(for viewController: UIViewController, completion: @escaping (MsrAttachment?) -> Void) {
        guard let measureInternal = self.measureInternal else {
            completion(nil)
            return
        }
        measureInternal.captureScreenshot(for: viewController) { msrAttachment in
            completion(msrAttachment)
        }
    }

    @objc func captureLayoutSnapshot(for viewController: UIViewController, completion: @escaping (MsrAttachment?) -> Void) {
        guard let measureInternal = self.measureInternal else {
            completion(nil)
            return
        }

        measureInternal.captureLayoutSnapshot(for: viewController) { msrAttachment in
            completion(msrAttachment)
        }
    }

    func trackError(_ error: Error, attributes: [String: AttributeValue]? = nil, collectStackTraces: Bool = false) {
        guard let measureInternal = self.measureInternal else { return }
        return measureInternal.trackError(error, attributes: attributes, collectStackTraces: collectStackTraces)
    }

    @objc func trackError(_ error: NSError, attributes: [String: Any]? = nil, collectStackTraces: Bool = false) {
        guard let measureInternal = self.measureInternal else { return }
        return measureInternal.trackError(error, attributes: attributes, collectStackTraces: collectStackTraces)
    }

    func internalGetAttachmentDirectory() -> String? {
        guard let measureInternal = self.measureInternal else { return nil }
        return measureInternal.getDocumentDirectoryPath()
    }

    func trackHttpEvent(url: String,
                        method: String,
                        startTime: UInt64,
                        endTime: UInt64,
                        client: String = "unknown",
                        statusCode: Int? = nil,
                        error: Error? = nil,
                        requestHeaders: [String: String]? = nil,
                        responseHeaders: [String: String]? = nil,
                        requestBody: String? = nil,
                        responseBody: String? = nil) {
        guard let measureInternal = self.measureInternal else { return }
        measureInternal.trackHttpEvent(url: url,
                                       method: method,
                                       startTime: startTime,
                                       endTime: endTime,
                                       client: client,
                                       statusCode: statusCode,
                                       error: error,
                                       requestHeaders: requestHeaders,
                                       responseHeaders: responseHeaders,
                                       requestBody: requestBody,
                                       responseBody: responseBody)
    }
}

// MARK: - Static Convenience API

extension Measure {
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
    ///   Measure.initialize(with: clientInfo, config: config)
    ///   ```
    ///   - Objective-C:
    ///   ```objc
    ///   ClientInfo *clientInfo = [[ClientInfo alloc] initWithApiKey:@"<apiKey>" apiUrl:@"<apiUrl>"];
    ///   BaseMeasureConfig *config = [[BaseMeasureConfig alloc] initWithEnableLogging:YES
    ///                                                          samplingRateForErrorFreeSessions:1.0
    ///                                                          traceSamplingRate:1.0
    ///                                                          trackHttpHeaders:YES
    ///                                                          trackHttpBody:YES
    ///                                                          httpHeadersBlocklist:@[]
    ///                                                          httpUrlBlocklist:@[]
    ///                                                          httpUrlAllowlist:@[]
    ///                                                          autoStart:true
    ///                                                          trackViewControllerLoadTime:true
    ///                                                          screenshotMaskLevel:ScreenshotMaskLevelObjcAllText
    ///                                                          requestHeadersProvider:nil];
    ///   [Measure initializeWith:clientInfo config:config];
    ///   ```
    @objc public static func initialize(with client: ClientInfo, config: BaseMeasureConfig? = nil) {
        Measure.shared.initialize(with: client, config: config)
    }

    /// Starts tracking.
    ///
    /// - SeeAlso: `stop()` to stop tracking.
    /// - SeeAlso: `MeasureConfig.autoStart` to control whether the SDK should start on initialization.
    ///
    /// - Example:
    ///   - Swift:
    ///   ```swift
    ///   Measure.start()
    ///   ```
    ///   - Objective-C:
    ///   ```objc
    ///   [Measure start];
    ///   ```
    @objc public static func start() {
        Measure.shared.start()
    }

    /// Stops tracking.
    ///
    /// - SeeAlso: `start()` to resume tracking.
    /// - SeeAlso: `MeasureConfig.autoStart` to control whether the SDK should start on initialization.
    ///
    /// - Example:
    ///   - Swift:
    ///   ```swift
    ///   Measure.stop()
    ///   ```
    ///   - Objective-C:
    ///   ```objc
    ///   [Measure stop];
    ///   ```
    @objc public static func stop() {
        Measure.shared.stop()
    }

    /// Returns the session ID for the current session, or nil if the SDK has not been initialized.
    ///
    /// A session represents a continuous period of activity in the app. A new session begins when the app is launched for the first time, or when there's been no activity for a 20-minute period.
    /// A single session can continue across multiple app background and foreground events; brief interruptions will not cause a new session to be created.
    /// - Returns: The session ID if the SDK is initialized, or nil otherwise.
    @objc public static func getSessionId() -> String? {
        Measure.shared.getSessionId()
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
    public static func internalTrackEvent(data: inout [String: Any?], // swiftlint:disable:this function_parameter_count
                                          type: String,
                                          timestamp: Int64,
                                          attributes: [String: Any?],
                                          userDefinedAttrs: [String: AttributeValue],
                                          userTriggered: Bool,
                                          sessionId: String?,
                                          threadName: String?,
                                          attachments: [MsrAttachment]) {
        Measure.shared.internalTrackEvent(data: &data,
                                          type: type,
                                          timestamp: timestamp,
                                          attributes: attributes,
                                          userDefinedAttrs: userDefinedAttrs,
                                          userTriggered: userTriggered,
                                          sessionId: sessionId,
                                          threadName: threadName,
                                          attachments: attachments)
    }

    /// An internal method to track spans from cross-platform frameworks
    /// like Flutter and React Native.
    ///
    /// This method is not intended for public usage and can change in future versions. To
    /// track spans use startSpan or createSpanBuilder.
    ///
    /// - **Parameters**:
    ///   - name: The name of the span.
    ///   - traceId: The trace id this span is part of.
    ///   - spanId: A unique identifier for this span.
    ///   - parentId: An optional span id of the parent span.
    ///   - startTime: The time in milliseconds since epoch when this span was started.
    ///   - endTime: The time in milliseconds since epoch when this span ended.
    ///   - duration: The duration of the operation represented by this span.
    ///   - status: The span status.
    ///   - attributes: Key-value pairs providing additional context to the span. Must be one of
    ///     the supported Attribute types.
    ///   - userDefinedAttrs: Custom key-value pairs providing additional context to the span.
    ///   - checkpoints: A map of checkpoint name to timestamp.
    ///   - hasEnded: Whether the span has ended.
    ///   - isSampled: Whether the span has been sampled or not.
    public static func internalTrackSpan(name: String, // swiftlint:disable:this function_parameter_count
                                         traceId: String,
                                         spanId: String,
                                         parentId: String?,
                                         startTime: Int64,
                                         endTime: Int64,
                                         duration: Int64,
                                         status: Int64,
                                         attributes: [String: Any?],
                                         userDefinedAttrs: [String: AttributeValue],
                                         checkpoints: [String: Int64],
                                         hasEnded: Bool,
                                         isSampled: Bool) {
        Measure.shared.internalTrackSpan(name: name,
                                         traceId: traceId,
                                         spanId: spanId,
                                         parentId: parentId,
                                         startTime: startTime,
                                         endTime: endTime,
                                         duration: duration,
                                         status: status,
                                         attributes: attributes,
                                         userDefinedAttrs: userDefinedAttrs,
                                         checkpoints: checkpoints,
                                         hasEnded: hasEnded,
                                         isSampled: isSampled)
    }

    /// Tracks an event with optional timestamp.
    /// Event names should be clear and consistent to aid in dashboard searches
    ///
    ///   ```swift
    ///   Measure.trackEvent(name: "event-name", attributes:["user_name": .string("Alice")], timestamp: nil)
    ///   ```
    /// - Parameters:
    ///   - name: Name of the event (max 64 characters)
    ///   - attributes: Key-value pairs providing additional context
    ///   - timestamp: Optional timestamp for the event, defaults to current time
    ///
    public static func trackEvent(name: String, attributes: [String: AttributeValue], timestamp: Int64? = nil) {
        Measure.shared.trackEvent(name: name, attributes: attributes, timestamp: timestamp)
    }

    /// Tracks an event with optional timestamp.
    /// Event names should be clear and consistent to aid in dashboard searches
    ///
    /// Note:
    /// This method is primarily intended for Objective-C use.
    ///
    ///   ```objc
    ///   [Measure trackEvent:@"event-name" attributes:@{@"user_name": @"Alice"} timestamp:nil];
    ///   ```
    /// - Parameters:
    ///   - name: Name of the event (max 64 characters)
    ///   - attributes: Key-value pairs providing additional context
    ///   - timestamp: Optional timestamp for the event, defaults to current time
    @objc public static func trackEvent(_ name: String, attributes: [String: Any], timestamp: NSNumber? = nil) {
        Measure.shared.trackEvent(name, attributes: attributes, timestamp: timestamp)
    }

    /// Call when a screen is viewed by the user.
    /// 
    /// Measure SDK automatically collects screen view events for UIKit and SwiftUI navigation.
    /// However, if your app uses a custom navigation system, you can use this method to track
    /// screen view events and gain more context when debugging issues.
    /// 
    /// Example usage:
    /// ```swift
    /// Measure.trackScreenView("Home", attributes:["user_name": .string("Alice")])
    /// ```
    ///
    /// - Parameters:
    ///   - screenName: The name of the screen being viewed.
    ///   - attributes: Optional key-value pairs providing additional context to the event.
    public static func trackScreenView(_ screenName: String, attributes: [String: AttributeValue]?) {
        Measure.shared.trackScreenView(screenName, attributes: attributes)
    }

    /// Call when a screen is viewed by the user.
    ///
    /// Measure SDK automatically collects screen view events for UIKit and SwiftUI navigation.
    /// However, if your app uses a custom navigation system, you can use this method to track
    /// screen view events and gain more context when debugging issues.
    ///
    /// Example usage:
    ///
    /// ```objc
    /// [Measure trackScreenView:@"ObjcViewController" attributes:@{@"user_name": @"Alice"}]
    /// ```
    /// - Parameters:
    ///   - screenName: The name of the screen being viewed.
    ///   - attributes: Optional key-value pairs providing additional context to the event.
    @objc public static func trackScreenView(_ screenName: String, attributes: [String: Any]?) {
        Measure.shared.trackScreenView(screenName, attributes: attributes)
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
    /// Measure.setUserId("user_id")
    /// ```
    ///
    /// ```objc
    /// [Measure setUserId:@"user_id"]
    /// ```
    ///
    /// - Parameter userId: userId string.
    @objc public static func setUserId(_ userId: String) {
        Measure.shared.setUserId(userId)
    }

    /// Clears the user ID, if previously set by `setUserId`.
    ///
    /// Example usage:
    /// ```swift
    /// Measure.clearUserId()
    /// ```
    ///
    /// ```objc
    /// [Measure clearUserId]
    /// ```
    @objc public static func clearUserId() {
        Measure.shared.clearUserId()
    }

    /// Returns the current time in milliseconds since epoch.
    /// - Returns: The current time in milliseconds since epoch.
    @objc public static func getCurrentTime() -> Int64 {
        Measure.shared.getCurrentTime()
    }

    /// Starts a new performance tracing span with the specified name.
    /// - Parameter name: The name to identify this span. Follow the naming convention guide for consistent naming practices.
    /// - Returns: A new span instance if the SDK is initialized, or an invalid no-op span if not initialized
    public static func startSpan(name: String) -> Span {
        Measure.shared.startSpan(name: name)
    }

    /// Starts a new performance tracing span with the specified name and start timestamp.
    /// - Parameters:
    ///   - name: The name to identify this span. Follow the naming convention guide for consistent naming practices.
    ///   - timestamp: The milliseconds since epoch when the span started. Must be obtained using `getCurrentTime()` to minimize clock drift effects.
    /// - Returns: A new span instance if the SDK is initialized, or an invalid no-op span if not initialized
    ///
    /// Note: Use this method when you need to trace an operation that has already started and you have
    /// captured its start time using `getCurrentTime()`.
    public static func startSpan(name: String, timestamp: Int64) -> Span {
        Measure.shared.startSpan(name: name, timestamp: timestamp)
    }

    /// Creates a configurable span builder for deferred span creation.
    /// - Parameter name: The name to identify this span. Follow the naming convention guide for consistent naming practices.
    /// - Returns: A builder instance to configure the span if the SDK is initialized, or nil if the SDK is not initialized
    ///
    /// Note: Use this method when you need to create a span without immediately starting it.
    public static func createSpanBuilder(name: String) -> SpanBuilder? {
        Measure.shared.createSpanBuilder(name: name)
    }

    /// Returns the W3C traceparent header value for the given span.
    /// - Parameter span: The span to extract the traceparent header value from
    /// - Returns: A W3C trace context compliant header value in the format: `{version}-{traceId}-{spanId}-{traceFlags}`
    ///
    /// Example: `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`
    ///
    /// Note: Use this value in the `traceparent` HTTP header when making API calls to enable
    /// distributed tracing between your mobile app and backend services.
    public static func getTraceParentHeaderValue(span: Span) -> String {
        Measure.shared.getTraceParentHeaderValue(span: span)
    }

    /// Returns the W3C traceparent header key/name.
    /// - Returns: The standardized header key 'traceparent' that should be used when adding
    /// distributed tracing context to HTTP requests
    public static func getTraceParentHeaderKey() -> String {
        Measure.shared.getTraceParentHeaderKey()
    }

    /// Takes a screenshot and launches the bug report flow.
    /// - Parameters:
    ///   - takeScreenshot: Set to `false` to disable the screenshot. Defaults to `true`.
    ///   - bugReportConfig: A configuration object used to customize the appearance and behavior of the bug report UI.
    ///   - attributes: Optional key-value pairs for additional metadata about the bug report.
    public static func launchBugReport(takeScreenshot: Bool = true,
                                       bugReportConfig: BugReportConfig = .default,
                                       attributes: [String: AttributeValue]? = nil) {
        Measure.shared.launchBugReport(takeScreenshot: takeScreenshot,
                                       bugReportConfig: bugReportConfig,
                                       attributes: attributes)
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
    @objc public static func launchBugReport(takeScreenshot: Bool = true,
                                             bugReportConfig: BugReportConfig = .default,
                                             attributes: [String: Any]? = nil) {
        Measure.shared.launchBugReport(takeScreenshot: takeScreenshot,
                                       bugReportConfig: bugReportConfig,
                                       attributes: attributes)
    }

    /// Sets a custom shake listener using a closure for handling shake gestures.
    ///
    /// - Note:
    ///   - Setting a non-`nil` handler enables shake detection.
    ///   - Setting `nil` disables shake detection.
    ///   - Has no effect if automatic shake reporting is already enabled.
    ///
    /// - Parameter handler: Closure to call when shake is detected.
    @objc public static func onShake(_ handler: (() -> Void)?) {
        Measure.shared.onShake(handler)
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
    public static func trackBugReport(description: String,
                                      attachments: [MsrAttachment] = [],
                                      attributes: [String: AttributeValue]? = nil) {
        Measure.shared.trackBugReport(description: description,
                                      attachments: attachments,
                                      attributes: attributes)
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
    @objc public static func trackBugReport(description: String,
                                            attachments: [MsrAttachment] = [],
                                            attributes: [String: Any]? = nil) {
        Measure.shared.trackBugReport(description: description,
                                      attachments: attachments,
                                      attributes: attributes)
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
    @objc public static func captureScreenshot(for viewController: UIViewController,
                                               completion: @escaping (MsrAttachment?) -> Void) {
        Measure.shared.captureScreenshot(for: viewController, completion: completion)
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
    @objc public static func captureLayoutSnapshot(for viewController: UIViewController,
                                                   completion: @escaping (MsrAttachment?) -> Void) {
        Measure.shared.captureLayoutSnapshot(for: viewController, completion: completion)
    }

    /// Tracks a handled Swift error (`Error`) and records it as part of the monitoring system.
    /// - Parameters:
    ///   - error: The Swift `Error` instance to track. Use this for native Swift errors (e.g. enums or structs conforming to `Error`).
    ///   - attributes: Optional key-value pairs for additional metadata about the error (e.g. request ID, user action, component).
    ///   - collectStackTraces: If `true`, captures the current stack trace to aid in debugging.
    public static func trackError(_ error: Error, attributes: [String: AttributeValue]? = nil, collectStackTraces: Bool = false) {
        Measure.shared.trackError(error, attributes: attributes, collectStackTraces: collectStackTraces)
    }

    /// Tracks a handled Objective-C style error (`NSError`) for backward compatibility or bridging scenarios.
    /// - Parameters:
    ///   - error: The `NSError` instance to track. Ideal for errors coming from Apple frameworks or Objective-C code.
    ///   - attributes: Optional key-value pairs for additional metadata about the error (e.g. file path, HTTP status, method name).
    ///   - collectStackTraces: If `true`, captures the current stack trace to aid in debugging.
    @objc public static func trackError(_ error: NSError, attributes: [String: Any]? = nil, collectStackTraces: Bool = false) {
        Measure.shared.trackError(error, attributes: attributes, collectStackTraces: collectStackTraces)
    }

    /// An internal method get the directory path wheere attachments are stored, used by cross-platform frameworks
    /// like Flutter and React Native.
    ///
    /// This method is not intended for public usage and can change in future versions.
    public static func internalGetAttachmentDirectory() -> String? {
        return Measure.shared.internalGetAttachmentDirectory()
    }

    /// Tracks a HTTP event. Note that if you're using the Measure gradle plugin,
    /// OkHttp events will be automatically tracked. This method is useful if you
    /// use any other HTTP client.
    ///
    /// Usage notes:
    /// - Always set the `statusCode` in case of a response or `error` in case the request failed.
    /// - Use a time source that provides monotonic time (like `CFAbsoluteTimeGetCurrent()` or a custom one based on `mach_absolute_time()`) for start and end time to avoid clock skew issues.
    /// - Use `requestHeaders`, `responseHeaders`, `requestBody` and `responseBody` only when
    /// required as they can increase the amount of data to be stored and sent considerably.
    /// - Request body is only tracked if the request headers contain the `Content-Type` header set to `application/json`.
    /// Similarly, response body is only tracked if the response headers contain the `Content-Type` header set to `application/json`.
    ///
    /// - Parameters:
    ///   - url: The URL to which the request was made
    ///   - method: The HTTP method used for the request
    ///   - startTime: The time when the HTTP request started (recommended to use a monotonic time source)
    ///   - endTime: The time when the HTTP request ended (recommended to use a monotonic time source)
    ///   - client: The name of the HTTP client used, optional (defaults to "unknown")
    ///   - statusCode: The HTTP status code of the response received
    ///   - error: The error if the request fails.
    ///   - requestHeaders: The HTTP headers in the request
    ///   - responseHeaders: The HTTP headers in the response
    ///   - requestBody: An optional request body
    ///   - responseBody: An optional response body
    public static func trackHttpEvent(url: String,
                                      method: String,
                                      startTime: UInt64,
                                      endTime: UInt64,
                                      client: String = "unknown",
                                      statusCode: Int? = nil,
                                      error: Error? = nil,
                                      requestHeaders: [String: String]? = nil,
                                      responseHeaders: [String: String]? = nil,
                                      requestBody: String? = nil,
                                      responseBody: String? = nil) {
        return Measure.shared.trackHttpEvent(url: url,
                                             method: method,
                                             startTime: startTime,
                                             endTime: endTime,
                                             client: client,
                                             statusCode: statusCode,
                                             error: error,
                                             requestHeaders: requestHeaders,
                                             responseHeaders: responseHeaders,
                                             requestBody: requestBody,
                                             responseBody: responseBody)
    }
} // swiftlint:disable:this file_length
