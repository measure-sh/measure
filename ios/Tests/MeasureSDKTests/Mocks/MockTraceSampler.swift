//
//  MockTraceSampler.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 13/04/25.
//

import Foundation
@testable import Measure

final class MockTraceSampler: TraceSampler {
    var sample: Bool = false

    func shouldSample() -> Bool {
        return sample
    }
}
