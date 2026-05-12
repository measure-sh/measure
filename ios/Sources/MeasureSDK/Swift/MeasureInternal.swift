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
    private var customEventCollector: CustomEventCollector {
        return measureInitializer.customEventCollector
    }
    private var userTriggeredEventCollector: UserTriggeredEventCollector {
        return measureInitializer.userTriggeredEventCollector
    }
    private var dataCleanupService: DataCleanupService {
        return measureInitializer.dataCleanupService
    }
    private var attachmentProcessor: AttachmentProcessor {
        return measureInitializer.attachmentProcessor
    }
    private var spanCollector: SpanCollector {
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
    private var bugReportCollector: BugReportCollector {
        return measureInitializer.bugReportCollector
    }
    private var shakeBugReportCollector: ShakeBugReportCollector {
        return measureInitializer.shakeBugReportCollector
    }
    private var shakeDetector: ShakeDetector {
        return measureInitializer.shakeDetector
    }
    private var screenshotGenerator: ScreenshotGenerator {
        return measureInitializer.screenshotGenerator
    }
    private var layoutSnapshotGenerator: LayoutSnapshotGenerator {
        return measureInitializer.layoutSnapshotGenerator
    }
    private var spanProcessor: SpanProcessor {
        return measureInitializer.spanProcessor
    }
    private var exporter: Exporter {
        return measureInitializer.exporter
    }
    private var signalStore: SignalStore {
        return measureInitializer.signalStore
    }
    private var measureDispatchQueue: MeasureDispatchQueue {
        return measureInitializer.measureDispatchQueue
    }
    private var launchTracker: LaunchTracker {
        return measureInitializer.launchTracker
    }
    var attributeTransformer: AttributeTransformer {
        return measureInitializer.attributeTransformer
    }
    private let lifecycleObserver: LifecycleObserver
    var isStarted: Bool = false
    var previousSessionCrashed = false

    init(_ measureInitializer: MeasureInitializer) {
        self.measureInitializer = measureInitializer
        self.lifecycleObserver = LifecycleObserver()
        self.launchTracker.setOnAppLaunchCallback {
            self.lifecycleCollector.applicationDidLaunch()
        }
        if configProvider.enableDiagnosticMode {
            let logWriter = SdkDebugLogWriter(fileManager: systemFileManager,
                                             sdkVersion: FrameworkInfo.version,
                                             fileId: "\(timeProvider.now())",
                                             timeProvider: timeProvider,
                                             measureDispatchQueue: measureDispatchQueue)
            logWriter.start()
            logger.setLogCallback { logLevel, message, error in
                logWriter.writeLog(level: logLevel, message: message, error: error)
            }

            if configProvider.enableDiagnosticModeGesture {
                enableDoubleTapGesture()
            }
        }
        self.sessionManager.start()
        self.lifecycleObserver.applicationDidEnterBackground = applicationDidEnterBackground
        self.lifecycleObserver.applicationWillEnterForeground = applicationWillEnterForeground
        self.lifecycleObserver.applicationWillTerminate = applicationWillTerminate
        self.lifecycleObserver.applicationDidBecomeActive = applicationDidBecomeActive
        self.lifecycleObserver.applicationWillResignActive = applicationWillResignActive
        self.logger.log(level: .info, message: "MeasureInternal: Initializing Measure SDK", error: nil, data: nil)
        self.sessionManager.setPreviousSessionCrashed(crashReportManager.hasPendingCrashReport)
        previousSessionCrashed = crashReportManager.hasPendingCrashReport
        self.sessionManager.setOnSessionStarted { [weak self] sessionId in
            guard let self else { return }
            if let timestamp = self.sessionManager.getSessionStartTime() {
                self.trackSessionStart(sessionId, timestamp: timestamp)
            }
        }
        self.crashDataPersistence.sessionId = sessionManager.sessionId
        let group = DispatchGroup()
        group.enter()
        self.crashReportManager.trackException {
            group.leave()
        }
        registerAlwaysOnCollectors()
        if configProvider.autoStart {
            start()
        }
        group.enter()
        configLoader.loadDynamicConfig { [weak self] dynamicConfig in
            guard let self else {
                group.leave()
                return
            }
            self.configProvider.setDynamicConfig(dynamicConfig)

            self.sessionManager.onConfigLoaded()
            self.spanProcessor.onConfigLoaded()
            self.appLaunchCollector.onConfigLoaded()
            self.cpuUsageCollector.onConfigLoaded()
            self.memoryUsageCollector.onConfigLoaded()
            group.leave()
        }
        group.notify(queue: .main) { [weak self] in
            guard let self else { return }
            self.exporter.export()
        }
    }

    private func enableDoubleTapGesture() {
        DispatchQueue.main.async {
            guard let window = UIWindow.keyWindow() else { return }
            let gesture = UITapGestureRecognizer(target: self, action: #selector(self.handleDiagnosticExport))
            gesture.numberOfTapsRequired = 2
            gesture.numberOfTouchesRequired = 2
            window.addGestureRecognizer(gesture)
        }
    }

    @objc private func handleDiagnosticExport() {
        guard let rootViewController = UIWindow.keyWindow()?.rootViewController else { return }
        guard let logsDir = systemFileManager.getSdkDebugLogsDirectory() else { return }

        let files: [URL]
        do {
            files = try FileManager.default.contentsOfDirectory(at: logsDir,
                                                                includingPropertiesForKeys: nil)
        } catch {
            logger.log(level: .error, message: "MeasureInternal: Failed to read SDK log files", error: error, data: nil)
            return
        }

        guard !files.isEmpty else {
            logger.log(level: .debug, message: "MeasureInternal: No SDK log files to export", error: nil, data: nil)
            return
        }

        let activityVC = UIActivityViewController(activityItems: files, applicationActivities: nil)
        rootViewController.present(activityVC, animated: true)
    }


    func start() {
        guard !isStarted else { return }

        self.logger.log(level: .info, message: "MeasureInternal: Starting Measure SDK", error: nil, data: nil)
        registedCollectors()
        isStarted = true
    }

    func stop() {
        guard isStarted && !configProvider.autoStart else { return }

        self.logger.log(level: .info, message: "MeasureInternal: Stopping Measure SDK", error: nil, data: nil)
        unregisterCollectors()
        isStarted = false
    }

    func trackEvent(name: String, attributes: [String: AttributeValue], timestamp: Int64?) {
        guard isStarted else { return }

        customEventCollector.trackEvent(name: name, attributes: attributes, timestamp: timestamp)
    }

    func trackEvent(_ name: String, attributes: [String: Any], timestamp: NSNumber?) {
        guard isStarted else { return }

        let transformedAttributes = attributeTransformer.transformAttributes(attributes)

        customEventCollector.trackEvent(name: name, attributes: transformedAttributes, timestamp: timestamp?.int64Value)
    }

    func trackScreenView(_ screenName: String, attributes: [String: AttributeValue]?) {
        guard isStarted else { return }

        userTriggeredEventCollector.trackScreenView(screenName, attributes: attributes)
    }

    func trackScreenView(_ screenName: String, attributes: [String: Any]?) {
        guard isStarted else { return }

        let transformedAttributes = attributeTransformer.transformAttributes(attributes)

        userTriggeredEventCollector.trackScreenView(screenName, attributes: transformedAttributes)
    }

    func setUserId(_ userId: String) {
        userAttributeProcessor.setUserId(userId)
    }

    func clearUserId() {
        userAttributeProcessor.clearUserId()
    }

    func createSpan(name: String) -> SpanBuilder? {
        return spanCollector.createSpan(name: name)
    }

    func startSpan(name: String, timestamp: Int64? = nil) -> Span {
        return spanCollector.startSpan(name: name, timestamp: timestamp)
    }

    func getTraceParentHeaderValue(for span: Span) -> String {
        return spanCollector.getTraceParentHeaderValue(for: span)
    }

    func getTraceParentHeaderKey() -> String {
        return spanCollector.getTraceParentHeaderKey()
    }

    func startSpanObjC(name: String) -> MsrObjCSpan {
        MsrObjCSpan(startSpan(name: name), attributeTransformer: attributeTransformer)
    }

    func startSpanObjC(name: String, timestamp: Int64) -> MsrObjCSpan {
        MsrObjCSpan(startSpan(name: name, timestamp: timestamp), attributeTransformer: attributeTransformer)
    }

    func createSpanBuilderObjC(name: String) -> MsrObjCSpanBuilder? {
        guard let builder = createSpan(name: name) else { return nil }
        return MsrObjCSpanBuilder(builder, attributeTransformer: attributeTransformer)
    }

    func getTraceParentHeaderValue(for objcSpan: MsrObjCSpan) -> String {
        getTraceParentHeaderValue(for: objcSpan.span)
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
        screenshotGenerator.generate(viewController: viewController) { attachment in
            completion(attachment)
        }
    }

    func captureLayoutSnapshot(for viewController: UIViewController, completion: @escaping (MsrAttachment?) -> Void) {
        layoutSnapshotGenerator.generate(for: viewController) { attachment in
            completion(attachment)
        }
    }

    func startBugReportFlow(takeScreenshot: Bool = true,
                            bugReportConfig: BugReportConfig,
                            attributes: [String: Any]? = nil) {
        guard isStarted else { return }

        let transformedAttributes = attributeTransformer.transformAttributes(attributes)
        startBugReportFlow(takeScreenshot: takeScreenshot, bugReportConfig: bugReportConfig, attributes: transformedAttributes)
    }

    func trackBugReport(description: String,
                        attachments: [MsrAttachment] = [],
                        attributes: [String: Any]? = nil) {
        guard isStarted else { return }

        let transformedAttributes = attributeTransformer.transformAttributes(attributes)
        trackBugReport(description: description, attachments: attachments, attributes: transformedAttributes)
    }

    func trackError(_ error: Error, attributes: [String: AttributeValue]? = nil, collectStackTraces: Bool) {
        guard isStarted else { return }

        userTriggeredEventCollector.trackError(error, attributes: attributes, collectStackTraces: collectStackTraces)
    }

    func trackError(_ error: NSError, attributes: [String: Any]? = nil, collectStackTraces: Bool) {
        guard isStarted else { return }

        let transformedAttributes = attributeTransformer.transformAttributes(attributes)
        userTriggeredEventCollector.trackError(error, attributes: transformedAttributes, collectStackTraces: collectStackTraces)
    }

    func trackException(_ exception: NSException, attributes: [String: AttributeValue]? = nil, collectStackTraces: Bool) {
        guard isStarted else { return }

        userTriggeredEventCollector.trackException(exception, attributes: attributes, collectStackTraces: collectStackTraces)
    }

    func trackException(_ exception: NSException, attributes: [String: Any]? = nil, collectStackTraces: Bool) {
        guard isStarted else { return }

        let transformedAttributes = attributeTransformer.transformAttributes(attributes)
        userTriggeredEventCollector.trackException(exception, attributes: transformedAttributes, collectStackTraces: collectStackTraces)
    }

    func getAttachmentDirectoryPath() -> String? {
        return systemFileManager.getAttachmentDirectoryPath()
    }

    func encodeWebP(pixels: Data, width: Int, height: Int, completion: @escaping (Data?) -> Void) {
        let quality = Int(configProvider.screenshotCompressionQuality)
        measureDispatchQueue.submit {
            let encoded = WebPEncoder.encode(pixels: pixels, width: width, height: height, quality: quality)
            DispatchQueue.main.async { completion(encoded) }
        }
    }

    func getDynamicConfigPath() -> String? {
        return systemFileManager.getDynamicConfigPath()
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

    func internalAddLog(platform: String, message: String) {
        logger.log(level: .info, message: "[\(platform)] \(message)", error: nil, data: nil)
    }

    private func applicationDidEnterBackground() {
        self.crashDataPersistence.isForeground = false
        self.internalSignalCollector.isForeground = false
        self.sessionManager.applicationDidEnterBackground()
        self.lifecycleCollector.applicationDidEnterBackground()
        self.unregisterCollectors()
        self.exporter.export()
        self.dataCleanupService.clearStaleData()
    }

    private func applicationWillEnterForeground() {
        self.appLaunchCollector.applicationWillEnterForeground()
        self.crashDataPersistence.isForeground = true
        self.internalSignalCollector.isForeground = true
        self.sessionManager.applicationWillEnterForeground()
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
        self.httpEventCollector.enable()
        self.networkChangeCollector.enable()
        self.lifecycleCollector.enable()
        self.spanCollector.enable()
        self.internalSignalCollector.enable()
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
        self.httpEventCollector.disable()
        self.networkChangeCollector.disable()
        self.gestureCollector.disable()
        self.lifecycleCollector.disable()
        self.spanCollector.disabled()
        self.internalSignalCollector.disable()
    }

    private func registerAlwaysOnCollectors() {
        self.appLaunchCollector.enable()
    }


    private func trackSessionStart(_ sessionId: String, timestamp: Number) {
        self.signalProcessor.track(data: SessionStartData(),
                                   timestamp: timestamp,
                                   type: .sessionStart,
                                   attributes: nil,
                                   sessionId: sessionId,
                                   attachments: nil,
                                   userDefinedAttributes: nil,
                                   threadName: nil,
                                   needsReporting: true,
                                   synchronous: false)
    }
}
