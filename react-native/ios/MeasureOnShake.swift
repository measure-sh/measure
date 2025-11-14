
import Foundation
import React

@objc(MeasureOnShake)
class MeasureOnShake: RCTEventEmitter {
  private var hasListeners = false

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  override func supportedEvents() -> [String]! {
    return ["MeasureOnShake"]
  }

  @objc func triggerShakeEvent() {
    if hasListeners {
      sendEvent(withName: "MeasureOnShake", body: nil)
    }
  }
}
