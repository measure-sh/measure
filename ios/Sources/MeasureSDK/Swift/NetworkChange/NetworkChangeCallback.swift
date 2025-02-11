//
//  NetworkChangeCallback.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 23/12/24.
//

import Foundation

final class NetworkChangeCallback {
    var onNetworkChangeCallback: ((_ data: NetworkChangeData) -> Void)?

    func onNetworkChange(_ data: NetworkChangeData) {
        onNetworkChangeCallback?(data)
    }
}
