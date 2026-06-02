//
//  GestureTargetFinder.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 03/10/24.
//

import UIKit

struct GestureTarget {
    let target: String?
    let targetId: String?
    let targetFrame: CGRect?
    let label: String?
    let semanticLabel: String?
}

protocol GestureTargetFinder {
    func findClickable(x: CGFloat, y: CGFloat, window: UIWindow) -> GestureTarget  // swiftlint:disable:this identifier_name
    func findScrollable(startScrollPoint: CGPoint, endScrollPoint: CGPoint, window: UIWindow) -> GestureTarget?
}

private let labelMaxChars = 32

final class BaseGestureTargetFinder: GestureTargetFinder {
    func findClickable(x: CGFloat, y: CGFloat, window: UIWindow) -> GestureTarget {  // swiftlint:disable:this identifier_name
        let tapPoint = CGPoint(x: x, y: y)

        if let tappedView = window.hitTest(tapPoint, with: nil) {
            let className = String(describing: type(of: tappedView))
            if className.contains("FlutterView") || className.contains("FlutterSemanticsScrollView") {
                return GestureTarget(target: nil, targetId: nil, targetFrame: nil, label: nil, semanticLabel: nil)
            }
            if className.contains("androidx.compose") {
                return GestureTarget(target: nil, targetId: nil, targetFrame: nil, label: nil, semanticLabel: nil)
            }

            if let resolved = resolveDeepestSubview(view: tappedView, tapPoint: tapPoint, window: window) {
                let resolvedClass = "\(type(of: resolved.view))"
                if resolvedClass.contains("FlutterView") || resolvedClass.contains("FlutterSemanticsScrollView") {
                    return GestureTarget(target: nil, targetId: nil, targetFrame: nil, label: nil, semanticLabel: nil)
                }
                return makeTarget(view: resolved.view, frame: resolved.frame, window: window)
            } else {
                return makeTarget(view: tappedView, frame: tappedView.frame, window: window)
            }
        }
        return GestureTarget(target: nil, targetId: nil, targetFrame: nil, label: nil, semanticLabel: nil)
    }

    private func resolveDeepestSubview(view: UIView, tapPoint: CGPoint, window: UIWindow) -> (view: UIView, frame: CGRect)? {
        for subview in view.subviews {
            let pointInSubview = view.convert(tapPoint, from: window)

            if subview.frame.contains(pointInSubview) {
                if subview.subviews.isEmpty {
                    let frame = CGRect(x: pointInSubview.x, y: pointInSubview.y, width: subview.frame.width, height: subview.frame.height)
                    return (subview, frame)
                } else {
                    return resolveDeepestSubview(view: subview, tapPoint: tapPoint, window: window)
                }
            }
        }
        return nil
    }

    private func makeTarget(view: UIView, frame: CGRect, window: UIWindow) -> GestureTarget {
        let masked = isMasked(view, in: window)
        let label = masked ? nil : extractLabel(from: view)
        let semanticLabel = masked ? nil : extractSemanticLabel(from: view)
        return GestureTarget(
            target: "\(type(of: view))",
            targetId: view.accessibilityIdentifier,
            targetFrame: frame,
            label: label,
            semanticLabel: semanticLabel
        )
    }

    /// Returns the first visible text found in this view's subtree, truncated to
    /// ``labelMaxChars``. Input fields are skipped so their contents never leak
    /// into the gesture label.
    private func extractLabel(from view: UIView) -> String? {
        guard let text = collectText(from: view) else { return nil }
        return truncateLabel(text)
    }

    private func collectText(from view: UIView) -> String? {
        if view is UITextField || view is UITextView {
            return nil
        }
        if let button = view as? UIButton {
            return normalizeLabel(button.currentTitle)
        }
        if let label = view as? UILabel {
            return normalizeLabel(label.text)
        }
        for subview in view.subviews {
            if let text = collectText(from: subview) {
                return text
            }
        }
        return nil
    }

    private func extractSemanticLabel(from view: UIView) -> String? {
        if view is UITextField || view is UITextView {
            return nil
        }
        guard let label = normalizeLabel(view.accessibilityLabel) else {
            return nil
        }
        return truncateLabel(label)
    }

    /// Returns true when a `.msrMask()` overlay covers the target, so its text is
    /// not captured. Mirrors the per-view masking applied to screenshots.
    private func isMasked(_ targetView: UIView, in window: UIWindow) -> Bool {
        let targetRect = targetView.convert(targetView.bounds, to: window)
        let center = CGPoint(x: targetRect.midX, y: targetRect.midY)
        return hasMaskedOverlay(window, covering: center, in: window)
    }

    private func hasMaskedOverlay(_ view: UIView, covering point: CGPoint, in window: UIWindow) -> Bool {
        if MsrRedactViewHelper.shouldMask(view) {
            let frame = view.convert(view.bounds, to: window)
            if frame.contains(point) {
                return true
            }
        }
        for subview in view.subviews where hasMaskedOverlay(subview, covering: point, in: window) {
            return true
        }
        return false
    }

    private func normalizeLabel(_ value: String?) -> String? {
        guard let value = value else { return nil }
        let collapsed = value.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        guard collapsed.contains(where: { $0.isLetter || $0.isNumber }) else {
            return nil
        }
        return collapsed
    }

    private func truncateLabel(_ value: String) -> String {
        if value.count > labelMaxChars {
            return String(value.prefix(labelMaxChars - 1)) + "…"
        }
        return value
    }

    func findScrollable(startScrollPoint: CGPoint, endScrollPoint: CGPoint, window: UIWindow) -> GestureTarget? {
        if let scrollableView = getView(in: window, startPointInWindow: startScrollPoint, endPointInWindow: endScrollPoint) {
            return GestureTarget(
                target: String(describing: type(of: scrollableView)),
                targetId: scrollableView.accessibilityIdentifier,
                targetFrame: scrollableView.frame,
                label: nil,
                semanticLabel: nil
            )
        }

        return nil
    }

    private func getView(in view: UIView, startPointInWindow: CGPoint, endPointInWindow: CGPoint) -> UIView? {
        let scrollableTypes: [UIView.Type] = [UIScrollView.self, UIDatePicker.self, UIPickerView.self]

        if scrollableTypes.contains(where: { view.isKind(of: $0) }) {
            if String(describing: type(of: view)) == "FlutterSemanticsScrollView" {
                return nil
            }

            if String(describing: type(of: view)).contains("androidx.compose") {
                return nil
            }

            let viewFrameInWindow = view.convert(view.bounds, to: view.window)
            if viewFrameInWindow.contains(startPointInWindow) && viewFrameInWindow.contains(endPointInWindow) {
                return view
            }
        }

        for subview in view.subviews {
            if let scrollableSubview = getView(in: subview, startPointInWindow: startPointInWindow, endPointInWindow: endPointInWindow) {
                return scrollableSubview
            }
        }

        return nil
    }
}
