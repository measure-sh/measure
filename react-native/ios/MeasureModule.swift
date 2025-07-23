import Foundation
import React

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
    print("✅ Received API key from JS: \(apiKey)")
    resolve("Swift module received API key: \(apiKey)")
  }
}