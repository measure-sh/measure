//
//  ContentView.swift
//  Measure
//
//  Created by Adwin Ross on 04/04/25.
//

import SwiftUI

struct DecodedEvent: Decodable {
    let id: String
    let timestamp: String
    let type: EventType
}

struct ContentView: View {
    @State private var events: [Event] = []

    var body: some View {
        VStack(alignment: .leading) {
            Text("📈 SDK Events")
                .font(.title2)
                .padding(.bottom, 5)

            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(events) { event in
                        HStack {
                            Text(event.timestamp.formatted(date: .omitted, time: .standard))
                                .font(.caption)
                                .foregroundColor(.gray)
                            Text(event.message)
                        }
                    }
                }
            }
            .frame(maxHeight: 500)
        }
        .padding()
        .frame(width: 360)
        .onAppear {
            EventReader.shared.startMonitoring { newLine in
                guard let data = newLine.data(using: .utf8) else { return }

                do {
                    let event = try JSONDecoder().decode(DecodedEvent.self, from: data)
                    let readable = "[\(event.timestamp)] \(event.type.rawValue) (\(event.id.prefix(6)))"
                    let uiEvent = Event(message: readable, timestamp: Date())
                    events.insert(uiEvent, at: 0)
                } catch {
                    print("⚠️ Failed to decode event: \(error)")
                }
            }
        }
    }
}
