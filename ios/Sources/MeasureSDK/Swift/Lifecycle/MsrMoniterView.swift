//
//  MsrMoniterView.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 29/10/24.
//

import SwiftUI

/// A SwiftUI view wrapper that monitors the lifecycle events (.onAppear, .onDisappear) of the wrapped view.
///
/// - Example:
/// ```swift
/// struct ContentView: View {
///     var body: some View {
///         MsrMoniterView("ContentView") {
///             Text("Hello, World!")
///         }
///     }
/// }
/// ```
@available(iOS 13, macOS 10.15, tvOS 13, watchOS 6.0, *)
public struct MsrMoniterView<Content: View>: View {
    @State private var hasViewAppeared = false

    let content: () -> Content
    let name: String

    public init(_ viewName: String? = nil, content: @escaping () -> Content) {
        self.content = content
        self.name = viewName ?? String(describing: content)
    }

    public var body: some View {
        if !hasViewAppeared {
            DispatchQueue.main.async {
                LifecycleManager.shared.sendSwiftUILifecycleEvent(.onAppear, for: name)
                self.hasViewAppeared = true
            }
        }

        return self.content()
            .onDisappear {
                LifecycleManager.shared.sendSwiftUILifecycleEvent(.onDisappear, for: name)
            }
    }
}

@available(iOS 13, macOS 10.15, tvOS 13, watchOS 6.0, *)
public extension View {
    /// An extension function on View that wraps the view in an MsrMoniterView to monitor its lifecycle events.
    /// - Parameter viewName: viewName: An optional String representing the name of the view to be monitored. If nil, it defaults to the type name of the view itself.
    /// - Returns: some View
    /// ```swift
    /// struct ContentView: View {
    ///     var body: some View {
    ///         Text("Hello, World!")
    ///             .moniterWithMsr("ContentView")
    ///     }
    /// }
    func moniterWithMsr(_ viewName: String? = nil) -> some View {
        return MsrMoniterView(viewName) {
            return self
        }
    }
}
