//
//  ContentView.swift
//  SwiftUIDemo
//
//  Created by Adwin Ross on 27/10/24.
//

import SwiftUI
import Measure

struct ContentView: View {
    @State private var isSheetPresented = false
    @State private var isFullScreenPresented = false
    @State private var showDetail = false
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            VStack {
                VStack(spacing: 16) {
                    // Button 1: Navigation Link
                    NavigationLink(destination: ContentView()) {
                        MsrMoniterView("viewname") {
                            Text("Navigate with NavigationLink")
                                .padding()
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                        }
                    }

                    // Button 2: Programmatic Navigation using NavigationPath
                    Button("Programmatic NavigationPath") {
                        path.append(1)
                    }
                    .padding()
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                    .navigationDestination(for: Int.self) { _ in
                        ContentView()
                    }

                    // Button 3: Modal Navigation using .sheet
                    Button("Present Modal with .sheet") {
                        isSheetPresented = true
                    }
                    .sheet(isPresented: $isSheetPresented) {
                        ContentView()
                    }
                    .padding()
                    .background(Color.orange)
                    .foregroundColor(.white)
                    .cornerRadius(8)

                    // Button 4: Full-Screen Cover
                    Button("Present Full Screen") {
                        isFullScreenPresented = true
                    }
                    .fullScreenCover(isPresented: $isFullScreenPresented) {
                        ContentView()
                    }
                    .padding()
                    .background(Color.purple)
                    .foregroundColor(.white)
                    .cornerRadius(8)

                    // Button 5: Tab-Based Navigation with .tabItem
                    NavigationLink(destination: TabView {
                        ContentView()
                            .tabItem { Label("Tab 1", systemImage: "1.circle") }
                        ContentView()
                            .tabItem { Label("Tab 2", systemImage: "2.circle") }
                    }) {
                        Text("Navigate with TabView")
                            .padding()
                            .background(Color.red)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                    }

                    // Button 6: Custom Navigation using isActive Binding
                    Button("Navigate with Custom Binding") {
                        showDetail = true
                    }
                    .background(
                        NavigationLink("", destination: ContentView(), isActive: $showDetail)
                            .hidden()
                    )
                    .padding()
                    .background(Color.gray)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
            }
            .padding()
        }
    }
}

#Preview {
    ContentView()
}
