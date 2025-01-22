//
//  CrashReport.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/09/24.
//

import CrashReporter
import Foundation

enum CrashReportProcessorTypeEncoding: UInt32 {
    case unknown = 0
    case mach = 1
}

enum CrashReportOperatingSystem: UInt32 {
    case macOSX = 0
    case iPhoneOS = 1
    case iPhoneSimulator = 2
    case unknown = 3
    case appleTVOS = 4
}

/// A protocol representing a crash report, which provides access to key crash data and system information.
///
/// This protocol allows the extraction of crash details such as binary images, processor information,
/// exception details, signal information, and thread states.
protocol CrashReport {
    var images: [PLCrashReportBinaryImageInfo]? { get }
    var typeEncoding: CrashReportProcessorTypeEncoding { get }
    var processorInfo: UInt64 { get }
    var exceptionName: String { get }
    var exceptionReason: String { get }
    var signalName: String { get }
    var osBuildNumber: String { get }
    var threads: [PLCrashReportThreadInfo]? { get }
    var operatingSystem: CrashReportOperatingSystem { get }
    func image(_ address: UInt64) -> PLCrashReportBinaryImageInfo?
}

/// A concrete implementation of the `CrashReport` protocol that wraps around a `PLCrashReport` object.
final class BaseCrashReport: CrashReport {
    let plCrashReport: PLCrashReport

    var images: [PLCrashReportBinaryImageInfo]? {
        return plCrashReport.images as? [PLCrashReportBinaryImageInfo]
    }

    var typeEncoding: CrashReportProcessorTypeEncoding {
        return CrashReportProcessorTypeEncoding(rawValue: plCrashReport.systemInfo.processorInfo.typeEncoding.rawValue) ?? .unknown
    }

    var processorInfo: UInt64 {
        return plCrashReport.systemInfo.processorInfo.type
    }

    var exceptionName: String {
        return plCrashReport.exceptionInfo?.exceptionName ?? ""
    }

    var exceptionReason: String {
        return plCrashReport.exceptionInfo?.exceptionReason ?? ""
    }

    var signalName: String {
        return plCrashReport.signalInfo.name
    }

    var osBuildNumber: String {
        return plCrashReport.systemInfo.operatingSystemBuild
    }

    var threads: [PLCrashReportThreadInfo]? {
        return plCrashReport.threads as? [PLCrashReportThreadInfo]
    }

    var operatingSystem: CrashReportOperatingSystem {
        return CrashReportOperatingSystem(rawValue: plCrashReport.systemInfo.operatingSystem.rawValue) ?? .unknown
    }

    init(_ plCrashReport: PLCrashReport) {
        self.plCrashReport = plCrashReport
    }

    func image(_ address: UInt64) -> PLCrashReportBinaryImageInfo? {
        return plCrashReport.image(forAddress: address)
    }
}
