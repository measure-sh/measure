//
//  MsrMonitorView.swift
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
///         MsrMonitorView("ContentView") {
///             Text("Hello, World!")
///         }
///     }
/// }
/// ```
@available(macOS 10.15, tvOS 13, watchOS 6.0, *)
public struct MsrMonitorView<Content: View>: View {
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

@available(macOS 10.15, tvOS 13, watchOS 6.0, *)
@available(*, deprecated, renamed: "MsrMonitorView")
public typealias MsrMoniterView<Content: View> = MsrMonitorView<Content>

@available(macOS 10.15, tvOS 13, watchOS 6.0, *)
public extension View {
    /// An extension function on View that wraps the view in an MsrMonitorView to monitor its lifecycle events.
    /// - Parameter viewName: viewName: An optional String representing the name of the view to be monitored. If nil, it defaults to the type name of the view itself.
    /// - Returns: some View
    /// ```swift
    /// struct ContentView: View {
    ///     var body: some View {
    ///         Text("Hello, World!")
    ///             .monitorWithMsr("ContentView")
    ///     }
    /// }
    func monitorWithMsr(_ viewName: String? = nil) -> some View {
        return MsrMonitorView(viewName) {
            return self
        }
    }

    @available(*, deprecated, renamed: "monitorWithMsr(_:)")
    func moniterWithMsr(_ viewName: String? = nil) -> some View {
        return monitorWithMsr(viewName)
    }
}
