//
//  MockBuildEnvironment.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 10/11/26.
//

import Foundation
@testable import Measure

final class MockBuildEnvironment: BuildEnvironment {
    var isDebugBuild: Bool

    init(isDebugBuild: Bool = false) {
        self.isDebugBuild = isDebugBuild
    }
}
