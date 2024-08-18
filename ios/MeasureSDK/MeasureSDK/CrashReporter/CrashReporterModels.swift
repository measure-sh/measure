//
//  CrashReporterModels.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 14/08/24.
//

import Foundation

struct ThreadInfo {
    let crashed: Bool
    var stackFrames: [StackFrameInfo]
    let threadNumber: Int
}

struct StackFrameInfo {
    let binaryName: String
    let binaryAddress: String
    let offset: String
    let frameIndex: Int
    let symbolAddress: String
}

struct BinaryImageInfo {
    let baseAddress: String
    let endAddress: String
    let designator: String
    let name: String
    let archName: String
    let uuid: String
    let path: String
}

struct RegisterInfo {
    let name: String
    let value: String
}
