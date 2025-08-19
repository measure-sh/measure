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
    func initialize(_ apiKey: String,
                    resolver resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
        let clientInfo = ClientInfo(apiKey: apiKey, apiUrl: "http://localhost:8080")
        let config = BaseMeasureConfig(enableLogging: true)
        Measure.initialize(with: clientInfo, config: config)
        resolve("Swift module received API key: \(apiKey)")
    }
}
