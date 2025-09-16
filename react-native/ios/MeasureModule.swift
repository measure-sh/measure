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
        
        Measure.initialize(with: clientInfo, config: config)
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

        // Convert userDefinedAttrs if needed (depends on your AttributeValue bridging)
        let userAttrs = userDefinedAttrs as? [String: Any?] ?? [:]

        // Attachments mapping (depends on how you expose MsrAttachment from JS → native)
        let msrAttachments: [MsrAttachment] = [] // TODO: map properly later

        Measure.internalTrackEvent(
            data: &mutableData,
            type: type as String,
            timestamp: timestamp.int64Value,
            attributes: attributes as? [String: Any?] ?? [:],
            userDefinedAttrs: userAttrs as? [String: AttributeValue] ?? [:],
            userTriggered: userTriggered,
            sessionId: sessionId as String?,
            threadName: threadName as String?,
            attachments: msrAttachments
        )
        resolve("Event tracked successfully")
}
}
