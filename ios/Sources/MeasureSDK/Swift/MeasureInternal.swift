//
//  MeasureInternal.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/08/24.
//

import Foundation
import UIKit

/// Internal implementation of the Measure SDK.
///
/// This class initializes the Measure SDK and hides the internal dependencies from the public API.
///
final class MeasureInternal { // swiftlint:disable:this type_body_length
    var measureInitializer: MeasureInitializer
    var logger: Logger {
        return measureInitializer.logger
    }
    private var client: Client {
        return measureInitializer.client
    }
    var sessionManager: SessionManager {
        return measureInitializer.sessionManager
    }
    var timeProvider: TimeProvider {
        return measureInitializer.timeProvider
    }
    var idProvider: IdProvider {
        return measureInitializer.idProvider
    }
    private var configLoader: ConfigLoader {
        return measureInitializer.configLoader
    }
    private var configProvider: ConfigProvider {
        return measureInitializer.configProvider
    }
    private var appAttributeProcessor: AppAttributeProcessor {
        return measureInitializer.appAttributeProcessor
    }
    private var deviceAttributeProcessor: DeviceAttributeProcessor {
        return measureInitializer.deviceAttributeProcessor
    }
    private var installationIdAttributeProcessor: InstallationIdAttributeProcessor {
        return measureInitializer.installationIdAttributeProcessor
    }
    private var networkStateAttributeProcessor: NetworkStateAttributeProcessor {
        return measureInitializer.networkStateAttributeProcessor
    }
    private var userAttributeProcessor: UserAttributeProcessor {
        return measureInitializer.userAttributeProcessor
    }
    private var userDefaultStorage: UserDefaultStorage {
        return measureInitializer.userDefaultStorage
    }
    private var attributeProcessors: [AttributeProcessor] {
        return measureInitializer.attributeProcessors
    }
    private var signalProcessor: SignalProcessor {
        return measureInitializer.signalProcessor
    }
    private var crashReportManager: CrashReportManager {
        return measureInitializer.crashReportManager
    }
    private var crashDataPersistence: CrashDataPersistence {
        get {
            return measureInitializer.crashDataPersistence
        }
        set {
            measureInitializer.crashDataPersistence = newValue
        }
    }
    private var systemFileManager: SystemFileManager {
        return measureInitializer.systemFileManager
    }
    private var sessionStore: SessionStore {
        return measureInitializer.sessionStore
    }
    private var coreDataManager: CoreDataManager {
        return measureInitializer.coreDataManager
    }
    private var eventStore: EventStore {
        return measureInitializer.eventStore
    }
    private var gestureCollector: GestureCollector {
        return measureInitializer.gestureCollector
    }
    private var networkClient: NetworkClient {
        return measureInitializer.networkClient
    }
    private var httpClient: HttpClient {
        return measureInitializer.httpClient
    }
    private var heartbeat: Heartbeat {
        return measureInitializer.heartbeat
    }
    private var periodicExporter: PeriodicExporter {
        return measureInitializer.periodicExporter
    }
    private var attachmentExporter: AttachmentExporter {
        return measureInitializer.attachmentExporter
    }
    private var lifecycleCollector: LifecycleCollector {
        return measureInitializer.lifecycleCollector
    }
    private var cpuUsageCollector: CpuUsageCollector {
        return measureInitializer.cpuUsageCollector
    }
    private var memoryUsageCollector: MemoryUsageCollector {
        return measureInitializer.memoryUsageCollector
    }
    private var appLaunchCollector: AppLaunchCollector {
        return measureInitializer.appLaunchCollector
    }
    private var httpEventCollector: HttpEventCollector {
        return measureInitializer.httpEventCollector
    }
    private var networkChangeCollector: NetworkChangeCollector {
        return measureInitializer.networkChangeCollector
    }
    var customEventCollector: CustomEventCollector {
        return measureInitializer.customEventCollector
    }
    var userTriggeredEventCollector: UserTriggeredEventCollector {
        return measureInitializer.userTriggeredEventCollector
    }
    var dataCleanupService: DataCleanupService {
        return measureInitializer.dataCleanupService
    }
    var attachmentProcessor: AttachmentProcessor {
        return measureInitializer.attachmentProcessor
    }
    var spanCollector: SpanCollector {
        return measureInitializer.spanCollector
    }
    var internalSignalCollector: InternalSignalCollector {
        get {
            return measureInitializer.internalSignalCollector
        }
        set {
            measureInitializer.internalSignalCollector = newValue
        }
    }
    var bugReportCollector: BugReportCollector {
        return measureInitializer.bugReportCollector
    }
    var shakeBugReportCollector: ShakeBugReportCollector {
        return measureInitializer.shakeBugReportCollector
    }
    var shakeDetector: ShakeDetector {
        return measureInitializer.shakeDetector
    }
    var screenshotGenerator: ScreenshotGenerator {
        return measureInitializer.screenshotGenerator
    }
    var layoutSnapshotGenerator: LayoutSnapshotGenerator {
        return measureInitializer.layoutSnapshotGenerator
    }
    private let lifecycleObserver: LifecycleObserver
    var isStarted: Bool = false

    init(_ measureInitializer: MeasureInitializer) {
        self.measureInitializer = measureInitializer
        self.lifecycleObserver = LifecycleObserver()
        self.lifecycleObserver.applicationDidEnterBackground = applicationDidEnterBackground
        self.lifecycleObserver.applicationWillEnterForeground = applicationWillEnterForeground
        self.lifecycleObserver.applicationWillTerminate = applicationWillTerminate
        self.lifecycleObserver.applicationDidBecomeActive = applicationDidBecomeActive
        self.lifecycleObserver.applicationWillResignActive = applicationWillResignActive
        self.logger.log(level: .info, message: "Initializing Measure SDK", error: nil, data: nil)
        self.sessionManager.setPreviousSessionCrashed(crashReportManager.hasPendingCrashReport)
        self.sessionManager.start { sessionId in
            self.trackSessionStart(sessionId: sessionId)
        }
        self.crashDataPersistence.prepareCrashFile()
        self.crashDataPersistence.sessionId = sessionManager.sessionId
        self.crashReportManager.trackException()
        registerAlwaysOnCollectors()
        if configProvider.autoStart {
            start()
        }
        configLoader.loadDynamicConfig { dynamicConfig in
            self.configProvider.setDynamicConfig(dynamicConfig)
        }
    }

    func start() {
        guard !isStarted else { return }

        self.logger.log(level: .info, message: "Starting Measure SDK", error: nil, data: nil)
        registedCollectors()
        isStarted = true
    }

    func stop() {
        guard isStarted && !configProvider.autoStart else { return }

        self.logger.log(level: .info, message: "Stopping Measure SDK", error: nil, data: nil)
        unregisterCollectors()
        isStarted = false
    }

    func trackEvent(name: String, attributes: [String: AttributeValue], timestamp: Int64?) {
        guard isStarted else { return }

        customEventCollector.trackEvent(name: name, attributes: attributes, timestamp: timestamp)
    }

    func trackEvent(_ name: String, attributes: [String: Any], timestamp: NSNumber?) {
        guard isStarted else { return }

        let transformedAttributes = transformAttributes(attributes)

        customEventCollector.trackEvent(name: name, attributes: transformedAttributes, timestamp: timestamp?.int64Value)
    }

    func trackScreenView(_ screenName: String, attributes: [String: AttributeValue]?) {
        guard isStarted else { return }

        userTriggeredEventCollector.trackScreenView(screenName, attributes: attributes)
    }

    func trackScreenView(_ screenName: String, attributes: [String: Any]?) {
        guard isStarted else { return }

        let transformedAttributes = transformAttributes(attributes)

        userTriggeredEventCollector.trackScreenView(screenName, attributes: transformedAttributes)
    }

    func setUserId(_ userId: String) {
        userAttributeProcessor.setUserId(userId)
    }

    func clearUserId() {
        userAttributeProcessor.clearUserId()
    }

    func createSpan(name: String) -> SpanBuilder? {
        guard isStarted else { return nil }

        return spanCollector.createSpan(name: name)
    }

    func startSpan(name: String, timestamp: Int64? = nil) -> Span {
        guard isStarted else { return InvalidSpan() }

        return spanCollector.startSpan(name: name, timestamp: timestamp)
    }

    func getTraceParentHeaderValue(for span: Span) -> String {
        return spanCollector.getTraceParentHeaderValue(for: span)
    }

    func getTraceParentHeaderKey() -> String {
        return spanCollector.getTraceParentHeaderKey()
    }

    func startBugReportFlow(takeScreenshot: Bool = true,
                            bugReportConfig: BugReportConfig,
                            attributes: [String: AttributeValue]? = nil) {
        guard isStarted else { return }

        bugReportCollector.startBugReportFlow(takeScreenshot: takeScreenshot, bugReportConfig: bugReportConfig, attributes: attributes)
    }

    func onShake(_ handler: (() -> Void)?) {
        guard isStarted else { return }

        shakeBugReportCollector.setShakeHandler(handler)
    }

    func trackBugReport(description: String,
                        attachments: [MsrAttachment],
                        attributes: [String: AttributeValue]?) {
        guard isStarted else { return }

        bugReportCollector.trackBugReport(description: description, attachments: attachments, attributes: attributes)
    }

    func captureScreenshot(for viewController: UIViewController, completion: @escaping (MsrAttachment?) -> Void) {
        guard isStarted else { return }

        screenshotGenerator.generate(viewController: viewController) { attachment in
            completion(attachment)
        }
    }

    func captureLayoutSnapshot(for viewController: UIViewController, completion: @escaping (MsrAttachment?) -> Void) {
        guard isStarted else { return }

        layoutSnapshotGenerator.generate(for: viewController) { attachment in
            completion(attachment)
        }
    }

    func startBugReportFlow(takeScreenshot: Bool = true,
                            bugReportConfig: BugReportConfig,
                            attributes: [String: Any]? = nil) {
        guard isStarted else { return }

        let transformedAttributes = transformAttributes(attributes)
        startBugReportFlow(takeScreenshot: takeScreenshot, bugReportConfig: bugReportConfig, attributes: transformedAttributes)
    }

    func trackBugReport(description: String,
                        attachments: [MsrAttachment] = [],
                        attributes: [String: Any]? = nil) {
        guard isStarted else { return }

        let transformedAttributes = transformAttributes(attributes)
        trackBugReport(description: description, attachments: attachments, attributes: transformedAttributes)
    }

    func trackError(_ error: Error, attributes: [String: AttributeValue]? = nil, collectStackTraces: Bool) {
        guard isStarted else { return }

        userTriggeredEventCollector.trackError(error, attributes: attributes, collectStackTraces: collectStackTraces)
    }

    func trackError(_ error: NSError, attributes: [String: Any]? = nil, collectStackTraces: Bool) {
        guard isStarted else { return }

        let transformedAttributes = transformAttributes(attributes)
        userTriggeredEventCollector.trackError(error, attributes: transformedAttributes, collectStackTraces: collectStackTraces)
    }

    func getDocumentDirectoryPath() -> String? {
        return systemFileManager.getDirectoryPath(directory: FileManager.SearchPathDirectory.documentDirectory)
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
        return userTriggeredEventCollector.trackHttpEvent(url: url,
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

    private func applicationDidEnterBackground() {
        self.crashDataPersistence.isForeground = false
        self.internalSignalCollector.isForeground = false
        self.sessionManager.applicationDidEnterBackground()
        self.periodicExporter.applicationDidEnterBackground()
        self.lifecycleCollector.applicationDidEnterBackground()
        self.unregisterCollectors()
        self.dataCleanupService.clearStaleData {}
    }

    private func applicationWillEnterForeground() {
        self.appLaunchCollector.applicationWillEnterForeground()
        self.crashDataPersistence.isForeground = true
        self.internalSignalCollector.isForeground = true
        self.sessionManager.applicationWillEnterForeground()
        self.periodicExporter.applicationWillEnterForeground()
        self.lifecycleCollector.applicationWillEnterForeground()
        self.registedCollectors()
    }

    private func applicationWillTerminate() {
        self.sessionManager.applicationWillTerminate()
        self.lifecycleCollector.applicationWillTerminate()
    }

    private func applicationDidBecomeActive() {
        self.appLaunchCollector.applicationDidBecomeActive()
    }

    private func applicationWillResignActive() {
        self.appLaunchCollector.applicationWillResignActive()
    }

    private func registedCollectors() {
        self.customEventCollector.enable()
        self.userTriggeredEventCollector.enable()
        self.cpuUsageCollector.enable()
        self.memoryUsageCollector.enable()
        self.periodicExporter.enable()
        self.httpEventCollector.enable()
        self.networkChangeCollector.enable()
        self.lifecycleCollector.enable()
        self.crashReportManager.enable()
        self.spanCollector.enable()
        self.internalSignalCollector.enable()
        self.attachmentExporter.enable()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            if let window = UIApplication.shared.windows.first {
                self.gestureCollector.enable(for: window)
            }
        }
    }

    private func unregisterCollectors() {
        self.customEventCollector.disable()
        self.userTriggeredEventCollector.disable()
        self.cpuUsageCollector.disable()
        self.memoryUsageCollector.disable()
        self.periodicExporter.disable()
        self.httpEventCollector.disable()
        self.networkChangeCollector.disable()
        self.gestureCollector.disable()
        self.lifecycleCollector.disable()
        self.crashReportManager.disable()
        self.spanCollector.disabled()
        self.internalSignalCollector.disable()
        self.attachmentExporter.disable()
    }

    private func registerAlwaysOnCollectors() {
        self.appLaunchCollector.enable()
    }

    private func transformAttributes(_ attributes: [String: Any]?) -> [String: AttributeValue] {
        guard let attributes = attributes else {
            return [:]
        }

        var transformedAttributes: [String: AttributeValue] = [:]

        for (key, value) in attributes {
            if let stringVal = value as? String {
                transformedAttributes[key] = .string(stringVal)
            } else if let boolVal = value as? Bool {
                transformedAttributes[key] = .boolean(boolVal)
            } else if let intVal = value as? Int {
                transformedAttributes[key] = .int(intVal)
            } else if let longVal = value as? Int64 {
                transformedAttributes[key] = .long(longVal)
            } else if let floatVal = value as? Float {
                transformedAttributes[key] = .float(floatVal)
            } else if let doubleVal = value as? Double {
                transformedAttributes[key] = .double(doubleVal)
            } else {
                logger.log(level: .fatal, message: "Attribute value can only be a string, boolean, integer, or double.", error: nil, data: nil)
            }
        }

        return transformedAttributes
    }

    private func trackSessionStart(sessionId: String?) {
        signalProcessor.track(data: SessionStartData(),
                              timestamp: timeProvider.now(),
                              type: .sessionStart,
                              attributes: nil,
                              sessionId: sessionId,
                              attachments: nil,
                              userDefinedAttributes: nil,
                              threadName: nil)
    }
}
