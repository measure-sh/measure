//
//  MockSvgGenerator.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 05/02/25.
//

import Foundation
@testable import Measure
import UIKit

final class MockSvgGenerator: SvgGenerator {
    var generatedData: Data?
    var capturedView: UIView?
    var capturedFrames: [CGRect] = []
    var capturedTargetView: UIView?

    func generate(for view: UIView, frames: [CGRect], targetView: UIView?) -> Data? {
        self.capturedView = view
        self.capturedFrames = frames
        self.capturedTargetView = targetView
        return generatedData
    }
}
