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

    var isInitialized = false
    var isStarted = false
    
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
        isInitialized = true
        isStarted = config.autoStart
        resolve("Native Measure SDK initialized successfully")
    }
    
    @objc
    func start(_ resolve: @escaping RCTPromiseResolveBlock,
               rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard isInitialized else {
            reject(ErrorMessages.sdkUninitialized, "Measure SDK is not initialized. Call initialize() first.", nil)
            return
        }
        guard !isStarted else {
            reject(ErrorMessages.sdkNotStarted, "Measure SDK is already started.", nil)
            return
        }
        Measure.start()
        isStarted = true
        resolve("Measure SDK started successfully")
    }
    
    @objc
    func stop(_ resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard isInitialized else {
            reject(ErrorMessages.sdkUninitialized, "Measure SDK is not initialized. Call initialize() first.", nil)
            return
        }
        guard isStarted else {
            reject(ErrorMessages.sdkNotStarted, "Measure SDK is not started. Call start() first.", nil)
            return
        }
        Measure.stop()
        isStarted = false
        resolve("Measure SDK stopped successfully")
    }
}
