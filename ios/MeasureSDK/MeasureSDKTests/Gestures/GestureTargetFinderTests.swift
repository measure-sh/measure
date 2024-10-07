//
//  GestureTargetFinderTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 06/10/24.
//

@testable import MeasureSDK
import XCTest

final class GestureTargetFinderTests: XCTestCase {
    var targetFinder: BaseGestureTargetFinder!
    var window: UIWindow!

    override func setUp() {
        super.setUp()
        targetFinder = BaseGestureTargetFinder()
        window = UIWindow(frame: CGRect(x: 0, y: 0, width: 300, height: 3000))
        window.makeKeyAndVisible()

        // Add 2000 nested views (1 contains 2, 2 contains 3, and so on)
        var previousView: UIView? = window
        for i in 1...2000 {
            var view: UIView
            if i != 2000 {
                view = UIView(frame: CGRect(x: 0, y: 0, width: 300, height: 50))
            } else {
                view = UIScrollView(frame: CGRect(x: 0, y: 0, width: 300, height: 50))
            }
            view.accessibilityIdentifier = "View-\(i)"
            previousView?.addSubview(view)
            previousView = view
        }
    }

    func testFindClickablePerformance() {
        // Simulate a tap on the 2000th view (deeply nested)
        let tapX: CGFloat = 150
        let tapY: CGFloat = 25 // Tap point within the view

        measure {
            let result = targetFinder.findClickable(x: tapX, y: tapY, window: window)
            XCTAssertNotNil(result.target)
            XCTAssertEqual(result.targetId, "View-2000")
        }
    }

    func testFindScrollablePerformance() {
        // Simulate a scroll gesture
        let startScrollPoint = CGPoint(x: 150, y: 25)
        let endScrollPoint = CGPoint(x: 150, y: 25)

        measure {
            let result = targetFinder.findScrollable(startScrollPoint: startScrollPoint, endScrollPoint: endScrollPoint, window: window)
            XCTAssertNotNil(result)
            XCTAssertEqual(result?.targetId, "View-2000")
        }
    }
}

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
                    return (target, targetId, targetFrame)
                } else {
                    return searchSubviews(view: subview, tapPoint: tapPoint, window: window)
                }
            }
        }
        return nil
    }


