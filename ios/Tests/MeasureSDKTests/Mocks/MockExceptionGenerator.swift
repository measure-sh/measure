//
//  MockExceptionGenerator.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 17/10/25.
//

import Foundation
@testable import Measure

final class MockExceptionGenerator: ExceptionGenerator {
    var exception: Exception?

    func generate(_ error: NSError, collectStackTraces: Bool) -> Exception? {
        return exception
    }
}
