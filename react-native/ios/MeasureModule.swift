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
}
