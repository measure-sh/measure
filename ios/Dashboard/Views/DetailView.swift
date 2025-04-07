//
//  DetailView.swift
//  Dashboard
//
//  Created by Adwin Ross on 04/04/25.
//

import SwiftUI

struct DetailView: View {
    @ObservedObject var loader: EventLoader
    @State private var selectedTypes: Set<String> = []
    @State private var showFilterPopover = false

    private var allEventTypes: [String] {
        Set(loader.events.map { $0.type.rawValue }).sorted()
    }

    private var filteredEvents: [Event<AnyCodable>] {
        guard !selectedTypes.isEmpty else { return loader.events }
        return loader.events.filter { selectedTypes.contains($0.type.rawValue) }
    }

    private var groupedEvents: [String: [Event<AnyCodable>]] {
        Dictionary(grouping: filteredEvents, by: { $0.sessionId })
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 8) {
                // Filter Button
                HStack {
                    Button {
                        showFilterPopover.toggle()
                    } label: {
                        Label("Filter Events", systemImage: "line.3.horizontal.decrease.circle")
                    }
                    .popover(isPresented: $showFilterPopover, arrowEdge: .bottom) {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("🎛️ Filter by Event Type")
                                .font(.headline)
                            Divider()

                            ScrollView {
                                VStack(alignment: .leading, spacing: 6) {
                                    ForEach(allEventTypes, id: \.self) { type in
                                        Toggle(isOn: Binding(
                                            get: { selectedTypes.contains(type) },
                                            set: { isOn in
                                                if isOn {
                                                    selectedTypes.insert(type)
                                                } else {
                                                    selectedTypes.remove(type)
                                                }
                                            }
                                        )) {
                                            Text(type.capitalized)
                                        }
                                    }
                                }
                            }

                            Divider()
                            HStack {
                                Button("Clear All") {
                                    selectedTypes.removeAll()
                                }
                                Spacer()
                                Button("Close") {
                                    showFilterPopover = false
                                }
                            }
                        }
                        .padding()
                        .frame(width: 240, height: 300)
                    }

                    Spacer()
                }
                .padding(.horizontal)

                // Grouped Event List
                List {
                    ForEach(groupedEvents.keys.sorted(), id: \.self) { sessionId in
                        Section(header: Text("🧩 Session: \(sessionId)").font(.subheadline)) {
                            ForEach(groupedEvents[sessionId] ?? []) { event in
                                NavigationLink(destination: EventDetailView(event: event)) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(event.type.rawValue.capitalized)
                                            .font(.headline)
                                        Text("🕒 \(event.timestamp)")
                                            .font(.caption)
                                        Text("🔗 \(event.id.prefix(8))")
                                            .font(.caption2)
                                            .foregroundColor(.gray)
                                    }
                                    .padding(.vertical, 4)
                                }
                            }
                        }
                    }
                }
                .listStyle(.inset)
            }
            .navigationTitle("📂 Filtered Events")
        }
    }
}
