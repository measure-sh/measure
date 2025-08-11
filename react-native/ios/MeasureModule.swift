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
        guard let apiKey = clientDict[MethodConstants.apiKey] as? String,
              let apiUrl = clientDict[MethodConstants.apiUrl] as? String else {
            reject(ErrorMessages.invalidArguments, "Missing or invalid client properties", nil)
            return
        }
        
        guard let config = configDict.decoded(as: BaseMeasureConfig.self) else {
            reject(ErrorMessages.invalidArguments, "Could not decode configDict", nil)
            return
        }
        
        let clientInfo = ClientInfo(apiKey: apiKey, apiUrl: apiUrl)
        
        Measure.initialize(with: clientInfo, config: config)
        resolve("Native Measure SDK initialized successfully")
    }
    
    @objc
    func start() {
        Measure.start()
    }
    
    @objc
    func stop() {
        Measure.stop()
    }
}
