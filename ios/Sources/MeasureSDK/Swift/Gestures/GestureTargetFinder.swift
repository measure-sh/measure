//
//  GestureTargetFinder.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 03/10/24.
//

import UIKit

typealias TargetFinderTuple = (target: String?, targetId: String?, targetFrame: CGRect?)

protocol GestureTargetFinder {
    func findClickable(x: CGFloat, y: CGFloat, window: UIWindow) -> TargetFinderTuple  // swiftlint:disable:this identifier_name
    func findScrollable(startScrollPoint: CGPoint, endScrollPoint: CGPoint, window: UIWindow) -> TargetFinderTuple?
}

final class BaseGestureTargetFinder: GestureTargetFinder {
    func findClickable(x: CGFloat, y: CGFloat, window: UIWindow) -> TargetFinderTuple {  // swiftlint:disable:this identifier_name
        let tapPoint = CGPoint(x: x, y: y)

        if let tappedView = window.hitTest(tapPoint, with: nil) {
            if let targetData = searchSubviews(view: tappedView, tapPoint: tapPoint, window: window) {
                return targetData
            } else {
                return ("\(type(of: tappedView))", tappedView.accessibilityIdentifier, tappedView.frame)
            }
        }
        return (nil, nil, nil)
    }

    private func searchSubviews(view: UIView, tapPoint: CGPoint, window: UIWindow) -> TargetFinderTuple? {
        var target: String?
        var targetId: String?
        var targetFrame: CGRect?
        for subview in view.subviews {
            let pointInSubview = view.convert(tapPoint, from: window)

            if subview.frame.contains(pointInSubview) {
                target = "\(type(of: subview))"
                targetFrame = subview.frame
                targetId = subview.accessibilityIdentifier
                if subview.subviews.isEmpty {
                    return (target, targetId, CGRect(x: pointInSubview.x, y: pointInSubview.y, width: targetFrame?.width ?? 0, height: targetFrame?.height ?? 0))
                } else {
                    return searchSubviews(view: subview, tapPoint: tapPoint, window: window)
                }
            }
        }
        return nil
    }

    func findScrollable(startScrollPoint: CGPoint, endScrollPoint: CGPoint, window: UIWindow) -> TargetFinderTuple? {
        if let scrollableView = getView(in: window, startPointInWindow: startScrollPoint, endPointInWindow: endScrollPoint) {
            return (String(describing: type(of: scrollableView)), scrollableView.accessibilityIdentifier, scrollableView.frame)
        }

        return nil
    }

    private func getView(in view: UIView, startPointInWindow: CGPoint, endPointInWindow: CGPoint) -> UIView? {
        let scrollableTypes: [UIView.Type] = [UIScrollView.self, UIDatePicker.self, UIPickerView.self]

        if scrollableTypes.contains(where: { view.isKind(of: $0) }) {
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
