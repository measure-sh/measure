//
//  LaunchCallbacks.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 18/11/24.
//

import Foundation

final class LaunchCallbacks {
    var onColdLaunchCallback: ((_ data: ColdLaunchData) -> Void)?
    var onWarmLaunchCallback: ((_ data: WarmLaunchData) -> Void)?
    var onHotLaunchCallback: ((_ data: HotLaunchData) -> Void)?

    func onColdLaunch(data: ColdLaunchData) {
        onColdLaunchCallback?(data)
    }

    func onWarmLaunch(data: WarmLaunchData) {
        onWarmLaunchCallback?(data)
    }

    func onHotLaunch(data: HotLaunchData) {
        onHotLaunchCallback?(data)
    }
}
