//
//  PerfHostApp.swift
//  PerfHost
//
//  Created by Adwin Ross on 22/08/26.
//

import SwiftUI

@main
struct PerfHostApp: App {
    var body: some Scene {
        WindowGroup {
            VStack(spacing: 8) {
                Text("Measure Perf Host")
                    .font(.headline)
                Text("Run the PerfTests scheme against this app.")
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
    }
}
