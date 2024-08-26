//
//  InternalConfig.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 25/08/24.
//

import Foundation

protocol InternalConfig {
    /// The interval at which to create a batch for export.
    var eventsBatchingIntervalMs: TimeInterval { get }
}
