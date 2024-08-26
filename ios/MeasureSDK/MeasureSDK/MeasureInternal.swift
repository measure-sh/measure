//
//  MeasureInternal.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 26/08/24.
//

import Foundation

struct MeasureInternal {
    let measureInitializer: MeasureInitializerProtocol

    init(_ measureInitializer: MeasureInitializerProtocol) {
        self.measureInitializer = measureInitializer
    }
}
