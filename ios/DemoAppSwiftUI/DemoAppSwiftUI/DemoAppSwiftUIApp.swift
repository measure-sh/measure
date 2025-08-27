//
//  DemoAppSwiftUIApp.swift
//  DemoAppSwiftUI
//
//  Created by Adwin Ross on 27/08/25.
//

import SwiftUI
import Measure

@main
struct DemoAppSwiftUIApp: App {
    init() {
        let clientInfo = ClientInfo(apiKey: "msrsh_48153449fa6045685d605a6dcb684cbf42d5b1cdf780cd79bd58a4423ce8b23d_e6b33343",
                                    apiUrl: "http://localhost:8080")
        let config = BaseMeasureConfig(enableLogging: true,
                                       samplingRateForErrorFreeSessions: 1.0)
        Measure.initialize(with: clientInfo, config: config)
    }

    var body: some Scene {
        WindowGroup {
            ContentView().moniterWithMsr()
        }
    }
}

