//
//  ContentView.swift
//  Dashboard
//
//  Created by Adwin Ross on 04/04/25.
//

import SwiftUI

struct ContentView: View {
    @StateObject private var loader = EventLoader()
    private let windowManager = WindowManager()

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Button("Open Measure") {
                    if let url = URL(string: "https://www.measure.sh/") {
                        NSWorkspace.shared.open(url)
                    }
                }

                Button("Show more Detail") {
                    windowManager.showDetailWindow(loader: loader)
                }
            }
            .buttonStyle(.bordered)
            .padding(.bottom, 4)

            List(loader.events) { event in
                VStack(alignment: .leading) {
                    Text("📌 \(event.type.rawValue.capitalized)")
                        .font(.headline)
                    Text("🕒 \(event.timestamp)")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
                .padding(.vertical, 2)
            }
            .listStyle(.inset)
        }
        .padding()
        .frame(width: 380, height: 600)
        .onAppear {
            loader.startReading()
        }
    }
}
#Preview {
    ContentView()
}
