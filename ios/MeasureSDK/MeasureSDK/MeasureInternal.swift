//
//  MeasureInternal.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/08/24.
//

import Foundation

/// Internal implementation of the Measure SDK.
///
/// This struct initializes the Measure SDK and hides the internal dependencies from the public API.
///
/// Properties:
/// - `measureInitializer`: An instance of `MeasureInitializer` used to configure and initialize the Measure SDK.
///
struct MeasureInternal {
    let measureInitializer: MeasureInitializer

    init(_ measureInitializer: MeasureInitializer) {
        self.measureInitializer = measureInitializer
    }
}
