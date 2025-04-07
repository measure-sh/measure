//
//  EventDetailView.swift
//  Dashboard
//
//  Created by Adwin Ross on 04/04/25.
//

import SwiftUI

struct EventDetailView: View {
    let event: Event<AnyCodable>

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("📝 Event Details")
                    .font(.title2)

                Text("Type: \(event.type.rawValue)")
                Text("Timestamp: \(event.timestamp)")
                Text("ID: \(event.id)")
                Text("Session ID: \(event.sessionId)")

                // Show full JSON if you want:
                if let jsonData = try? JSONEncoder().encode(event),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    TextEditor(text: .constant(jsonString))
                        .font(.system(.body, design: .monospaced))
                        .frame(minHeight: 200)
                }
            }
            .padding()
        }
        .frame(width: 600, height: 500)
    }
}
