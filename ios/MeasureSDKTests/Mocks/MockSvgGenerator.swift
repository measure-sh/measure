//
//  MockSvgGenerator.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 05/02/25.
//

import Foundation
@testable import MeasureSDK

final class MockSvgGenerator: SvgGenerator {
    var generatedData: Data?
    var capturedWindow: UIWindow?
    var capturedFrames: [CGRect] = []
    var capturedTargetView: UIView?

    func generate(for window: UIWindow, frames: [CGRect], targetView: UIView?) -> Data? {
        self.capturedWindow = window
        self.capturedFrames = frames
        self.capturedTargetView = targetView
        return generatedData
    }
}
