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
    var frames: [SvgFrame]?

    func generate(for frames: [SvgFrame], rootSize: CGSize) -> Data? {
        self.frames = frames
        return generatedData
    }
}
