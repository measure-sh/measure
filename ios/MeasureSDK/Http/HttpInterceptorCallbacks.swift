//
//  HttpInterceptorCallbacks.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 28/11/24.
//

import Foundation

final class HttpInterceptorCallbacks {
    var httpDataCallback: ((_ data: HttpData) -> Void)?

    func onHttpCompletion(data: HttpData) {
        guard let httpDataCallback = httpDataCallback else { return }
        httpDataCallback(data)
    }
}
