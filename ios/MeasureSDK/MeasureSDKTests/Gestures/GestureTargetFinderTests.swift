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
    var depth = 1500

    override func setUp() {
        super.setUp()
        targetFinder = BaseGestureTargetFinder()
        window = UIWindow(frame: CGRect(x: 0, y: 0, width: 300, height: 3000))
        window.makeKeyAndVisible()

        var previousView: UIView? = window
        for index in 1...depth {
            var view: UIView
            if index != depth {
                view = UIView(frame: CGRect(x: 0, y: 0, width: 300, height: 50))
            } else {
                view = UIScrollView(frame: CGRect(x: 0, y: 0, width: 300, height: 50))
            }
            view.accessibilityIdentifier = "View-\(index)"
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
            XCTAssertEqual(result.targetId, "View-\(depth)")
        }
    }

    func testFindScrollablePerformance() {
        // Simulate a scroll gesture
        let startScrollPoint = CGPoint(x: 150, y: 25)
        let endScrollPoint = CGPoint(x: 150, y: 25)

        measure {
            let result = targetFinder.findScrollable(startScrollPoint: startScrollPoint, endScrollPoint: endScrollPoint, window: window)
            XCTAssertNotNil(result)
            XCTAssertEqual(result?.targetId, "View-\(depth)")
        }
    }
}
