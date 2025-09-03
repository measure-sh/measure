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
        let clientInfo = ClientInfo(apiKey: "msrsh_297eb17091394bdcb6e57718f3e7ae2b4448322b2583312bd492891844dc21d1_e9467a30",
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

