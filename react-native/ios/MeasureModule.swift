import Foundation
import React
import Measure

@objc(MeasureModule)
class MeasureModule: NSObject, RCTBridgeModule {
    static func moduleName() -> String! {
        return "MeasureModule"
    }
    
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    @objc
    func initialize(_ clientDict: NSDictionary,
                    configDict: NSDictionary,
                    resolver resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let apiKey = clientDict["apiKey"] as? String,
              let apiUrl = clientDict["apiUrl"] as? String else {
            reject("invalid_args", "Missing or invalid client properties", nil)
            return
        }
        
        guard let config = configDict.decoded(as: BaseMeasureConfig.self) else {
            reject("invalid_args", "Could not decode configDict", nil)
            return
        }
        
        let clientInfo = ClientInfo(apiKey: apiKey, apiUrl: apiUrl)
        
        Measure.initialize(with: clientInfo, config: config)
        resolve("Swift module initialized with API key: \(apiKey)")
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
