//
//  MeasureBridge.swift
//  MeasureReactNative
//
//  Created by Adwin Ross on 02/07/25.
//

import Foundation
import Measure
import React

@objc(MeasureBridge)
class MeasureBridge: NSObject, RCTBridgeModule {
  static func moduleName() -> String! {
    return "MeasureBridge"
  }

  static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc
  func start(_ apiKey: String) {
    let clientInfo = ClientInfo(apiKey: "msrsh_38514d61493cf70ce99a11abcb461e9e6d823e2068c7124a0902b745598f7ffb_65ea2c1c",
                                    apiUrl: "http://localhost:8080")
        let config = BaseMeasureConfig(enableLogging: true,
                                       samplingRateForErrorFreeSessions: 1.0,
                                       traceSamplingRate: 1.0,
                                       autoStart: true,
                                       trackViewControllerLoadTime: true,
                                       screenshotMaskLevel: .sensitiveFieldsOnly)
        Measure.initialize(with: clientInfo, config: config)
  }
}