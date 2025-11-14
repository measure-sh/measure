import Foundation
import React
import Measure

@objc(MeasureModule)
class MeasureModule: NSObject, RCTBridgeModule {
    static func moduleName() -> String! {
        return ModuleConstants.moduleName
    }
    
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    @objc
    func initialize(_ clientDict: NSDictionary,
                    configDict: NSDictionary,
                    resolver resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let clientInfo = clientDict.decoded(as: ClientInfo.self) else {
            reject(ErrorMessages.invalidArguments, "Could not decode clientDict", nil)
            return
        }
        
        guard let config = configDict.decoded(as: BaseMeasureConfig.self) else {
            reject(ErrorMessages.invalidArguments, "Could not decode configDict", nil)
            return
        }
        
        DispatchQueue.main.async {
            Measure.initialize(with: clientInfo, config: config)
        }
        resolve("Native Measure SDK initialized successfully")
    }
    
    @objc
    func start(_ resolve: @escaping RCTPromiseResolveBlock,
               rejecter reject: @escaping RCTPromiseRejectBlock) {
        Measure.start()
        resolve("Measure SDK started successfully")
    }
    
    @objc
    func stop(_ resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
        Measure.stop()
        resolve("Measure SDK stopped successfully")
    }
    
    @objc
    func trackEvent(_ data: NSDictionary,
                    type: NSString,
                    timestamp: NSNumber,
                    attributes: NSDictionary,
                    userDefinedAttrs: NSDictionary,
                    userTriggered: Bool,
                    sessionId: NSString?,
                    threadName: NSString?,
                    attachments: NSArray,
                    resolver resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
        var mutableData = data as? [String: Any?] ?? [:]
        
        let userAttrs = userDefinedAttrs.transformAttributes()
        let msrAttachments: [MsrAttachment] = [] // TODO: map properly later
        
        Measure.internalTrackEvent(
            data: &mutableData,
            type: type as String,
            timestamp: timestamp.int64Value,
            attributes: attributes as? [String: Any?] ?? [:],
            userDefinedAttrs: userAttrs,
            userTriggered: userTriggered,
            sessionId: sessionId as String?,
            threadName: threadName as String?,
            attachments: msrAttachments
        )
        resolve("Event tracked successfully")
    }
    
    @objc
    func trackSpan(_ name: NSString,
                   traceId: NSString,
                   spanId: NSString,
                   parentId: NSString?,
                   startTime: NSNumber,
                   endTime: NSNumber,
                   duration: NSNumber,
                   status: NSNumber,
                   attributes: NSDictionary,
                   userDefinedAttrs: NSDictionary,
                   checkpoints: NSDictionary,
                   hasEnded: Bool,
                   isSampled: Bool,
                   resolver resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
        let attrDict = attributes as? [String: Any?] ?? [:]
        let checkpointDict = checkpoints as? [String: Int64] ?? [:]
        let userAttrs = userDefinedAttrs.transformAttributes()
        
        Measure.internalTrackSpan(
            name: name as String,
            traceId: traceId as String,
            spanId: spanId as String,
            parentId: parentId as String?,
            startTime: startTime.int64Value,
            endTime: endTime.int64Value,
            duration: duration.int64Value,
            status: status.int64Value,
            attributes: attrDict,
            userDefinedAttrs: userAttrs,
            checkpoints: checkpointDict,
            hasEnded: hasEnded,
            isSampled: isSampled
        )
        resolve("Span tracked successfully")
    }

    @objc
    func setUserId(_ userId: NSString,
                   resolver resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
        Measure.setUserId(userId as String)
        resolve("User ID set successfully")
    }

    @objc
    func clearUserId(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
        Measure.clearUserId()
        resolve("User ID cleared successfully")
    }

    @objc(trackHttpEvent:method:startTime:endTime:statusCode:error:requestHeaders:responseHeaders:requestBody:responseBody:client:resolver:rejecter:)
    func trackHttpEvent(
        url: String,
        method: String,
        startTime: NSNumber,
        endTime: NSNumber,
        statusCode: NSNumber?,
        error: String?,
        requestHeaders: [String: String]?,
        responseHeaders: [String: String]?,
        requestBody: String?,
        responseBody: String?,
        client: String,
        resolve: RCTPromiseResolveBlock,
        reject: RCTPromiseRejectBlock
    ) {
        Measure.trackHttpEvent(
            url: url,
            method: method,
            startTime: startTime.uint64Value,
            endTime: endTime.uint64Value,
            client: client,
            statusCode: statusCode?.intValue,
            error: error != nil ? NSError(domain: "", code: -1, userInfo: [NSLocalizedDescriptionKey: error!]) : nil,
            requestHeaders: requestHeaders,
            responseHeaders: responseHeaders,
            requestBody: requestBody,
            responseBody: responseBody
        )
        resolve("ok")
    }
    
    @objc
    func launchBugReport(_ takeScreenshot: Bool,
                         bugReportConfig: [String: Any],
                         attributes: [String: Any],
                         resolver: RCTPromiseResolveBlock,
                         rejecter: RCTPromiseRejectBlock) {
        Measure.launchBugReport(
            takeScreenshot: takeScreenshot,
            bugReportConfig: .default,
            attributes: attributes
        )
        resolver("Bug report launched")
    }
    
    @objc
    func setShakeListener(_ enable: Bool) {
        if enable {
            Measure.onShake {
                DispatchQueue.main.async {
                    if let bridge = RCTBridge.current(),
                       let emitter = bridge.module(for: MeasureOnShake.self) as? MeasureOnShake {
                        emitter.triggerShakeEvent()
                    }
                }
            }
        } else {
            Measure.onShake(nil)
        }
    }
}
