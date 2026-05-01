//
//  MsrMaskModifier.swift .swift
//  Measure
//
//  Created by Adwin Ross on 25/04/26.
//

import SwiftUI
import UIKit

private enum MsrMaskBehavior {
    case mask
    case unmask
}

private struct MsrRedactUIView: UIViewRepresentable {
    let behavior: MsrMaskBehavior

    class MsrOverlayView: UIView {}

    func makeUIView(context: Context) -> MsrOverlayView {
        MsrOverlayView()
    }

    func updateUIView(_ uiView: MsrOverlayView, context: Context) {
        switch behavior {
        case .mask: MsrRedactViewHelper.maskView(uiView)
        case .unmask: MsrRedactViewHelper.unmaskView(uiView)
        }
    }
}


private struct MsrMaskModifier: ViewModifier {
    @available(iOS 13.0, *)
    func body(content: Content) -> some View {
        content.overlay(MsrRedactUIView(behavior: .mask).disabled(true))
    }
}

private struct MsrUnmaskModifier: ViewModifier {
    @available(iOS 13.0, *)
    func body(content: Content) -> some View {
        content.overlay(MsrRedactUIView(behavior: .unmask).disabled(true))
    }
}

@available(iOS 13.0, *)
public extension View {
    /// Explicitly marks this SwiftUI view as sensitive so it gets masked
    /// in screenshots. Use this for views that cannot be automatically
    /// detected by the UIKit hierarchy walker, such as standalone Text
    /// views outside of List contexts.
    func msrMask() -> some View {
        modifier(MsrMaskModifier())
    }

    /// Exempts this SwiftUI view from masking. Use this to opt specific
    /// views out of the blanket _UIHostingView masking applied by default.
    func msrUnmask() -> some View {
        modifier(MsrUnmaskModifier())
    }
}
