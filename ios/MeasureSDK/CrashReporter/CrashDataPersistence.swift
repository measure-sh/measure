//
//  CrashDataPersistence.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 19/09/24.
//

import Foundation

typealias CrashDataAttributes = (attribute: Attributes?, sessionId: String?, isForeground: Bool?)

/// A protocol that defines the interface for managing crash data persistence.
///
/// Implementers of this protocol are responsible for managing the lifecycle of crash data, including
/// preparing crash files, writing crash data, reading it, and clearing the persisted data.
protocol CrashDataPersistence {
    var attribute: Attributes? { get set }
    var sessionId: String? { get set }
    var isForeground: Bool { get set }
    func prepareCrashFile()
    func writeCrashData()
    func readCrashData() -> CrashDataAttributes
    func clearCrashData()
}

/// A concrete implementation of the `CrashDataPersistence` protocol.
///
/// `BaseCrashDataPersistence` manages the persistence of crash-related data by saving it into the app's cache.
final class BaseCrashDataPersistence: CrashDataPersistence {
    var attribute: Attributes?
    var sessionId: String?
    var isForeground: Bool
    private let logger: Logger
    private var crashFileDescriptor: Int32 = -1
    private let systemFileManager: SystemFileManager

    init(attribute: Attributes? = nil, sessionId: String? = nil, isForeground: Bool = true, logger: Logger, systemFileManager: SystemFileManager) {
        self.attribute = attribute
        self.sessionId = sessionId
        self.isForeground = isForeground
        self.logger = logger
        self.systemFileManager = systemFileManager
    }

    func prepareCrashFile() {
        if let crashFilePath = systemFileManager.getCrashFilePath() {
            crashFileDescriptor = open(crashFilePath.path, O_WRONLY | O_CREAT | O_APPEND, S_IRUSR | S_IWUSR)
            if crashFileDescriptor == -1 {
                logger.internalLog(level: .error, message: "Failed to open crash log file at \(crashFilePath.path)", error: nil, data: nil)
            }
        }
    }

    func writeCrashData() {
        if crashFileDescriptor != -1 {
            let bytes = getAttributesData().cString(using: .utf8)
            if let bytes = bytes {
                write(crashFileDescriptor, bytes, strlen(bytes))
            }
        }
    }

    func clearCrashData() {
        if crashFileDescriptor != -1 {
            close(crashFileDescriptor)
            crashFileDescriptor = -1
        }

        if let crashFilePath = systemFileManager.getCrashFilePath() {
            let fileManager = FileManager.default
            if fileManager.fileExists(atPath: crashFilePath.path) {
                let fileDescriptor = open(crashFilePath.path, O_WRONLY | O_TRUNC)
                if fileDescriptor != -1 {
                    close(fileDescriptor)
                    logger.internalLog(level: .info, message: "Crash data file cleared at \(crashFilePath.path)", error: nil, data: nil)
                } else {
                    logger.internalLog(level: .error, message: "Failed to open crash log file for truncation at \(crashFilePath.path)", error: nil, data: nil)
                }
            } else {
                logger.internalLog(level: .error, message: "No crash data file found to clear at \(crashFilePath.path)", error: nil, data: nil)
            }
        }
    }

    func readCrashData() -> CrashDataAttributes {
        guard let crashFilePath = systemFileManager.getCrashFilePath() else {
            logger.internalLog(level: .error, message: "No crash data file found to read.", error: nil, data: nil)
            return (attribute: nil, sessionId: nil, isForeground: nil)
        }

        do {
            let crashDataString = try String(contentsOf: crashFilePath, encoding: .utf8)

            guard let data = crashDataString.data(using: .utf8) else {
                logger.internalLog(level: .error, message: "Failed to convert crash data string to Data", error: nil, data: nil)
                return (attribute: nil, sessionId: nil, isForeground: nil)
            }

            if let crashData = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
                let sessionId = crashData[CrashDataKeys.sessionId] as? String ?? ""
                let isForeground = crashData[CrashDataKeys.isForeground] as? Bool
                let attributes = getAttributes(crashData: crashData)
                return (attribute: attributes, sessionId: sessionId, isForeground: isForeground)
            }
            return (attribute: nil, sessionId: nil, isForeground: nil)
        } catch {
            logger.internalLog(level: .error, message: "Failed to read or parse crash data file at \(crashFilePath.path)", error: error, data: nil)
            return (attribute: nil, sessionId: nil, isForeground: nil)
        }
    }

    private func getAttributesData() -> String {
        return """
        {
            "\(CrashDataKeys.threadName)": "\(attribute?.threadName ?? "")",
            "\(CrashDataKeys.deviceName)": "\(attribute?.deviceName ?? "")",
            "\(CrashDataKeys.deviceModel)": "\(attribute?.deviceModel ?? "")",
            "\(CrashDataKeys.deviceManufacturer)": "\(attribute?.deviceManufacturer ?? "")",
            "\(CrashDataKeys.deviceType)": "\(attribute?.deviceType?.rawValue ?? "")",
            "\(CrashDataKeys.deviceIsFoldable)": \(attribute?.deviceIsFoldable ?? false),
            "\(CrashDataKeys.deviceIsPhysical)": \(attribute?.deviceIsPhysical ?? true),
            "\(CrashDataKeys.deviceDensityDpi)": \(attribute?.deviceDensityDpi ?? 0),
            "\(CrashDataKeys.deviceWidthPx)": \(attribute?.deviceWidthPx ?? 0),
            "\(CrashDataKeys.deviceHeightPx)": \(attribute?.deviceHeightPx ?? 0),
            "\(CrashDataKeys.deviceDensity)": \(attribute?.deviceDensity ?? 0),
            "\(CrashDataKeys.deviceLocale)": "\(attribute?.deviceLocale ?? "")",
            "\(CrashDataKeys.osName)": "\(attribute?.osName ?? "")",
            "\(CrashDataKeys.osVersion)": "\(attribute?.osVersion ?? "")",
            "\(CrashDataKeys.platform)": "\(attribute?.platform ?? "")",
            "\(CrashDataKeys.networkType)": "\(attribute?.networkType?.rawValue ?? "")",
            "\(CrashDataKeys.networkGeneration)": "\(attribute?.networkGeneration?.rawValue ?? "")",
            "\(CrashDataKeys.networkProvider)": "\(attribute?.networkProvider ?? "")",
            "\(CrashDataKeys.installationId)": "\(attribute?.installationId ?? "")",
            "\(CrashDataKeys.userId)": "\(attribute?.userId ?? "")",
            "\(CrashDataKeys.deviceCpuArch)": "\(attribute?.deviceCpuArch ?? "")",
            "\(CrashDataKeys.appVersion)": "\(attribute?.appVersion ?? "")",
            "\(CrashDataKeys.appBuild)": "\(attribute?.appBuild ?? "")",
            "\(CrashDataKeys.measureSdkVersion)": "\(attribute?.measureSdkVersion ?? "")",
            "\(CrashDataKeys.appUniqueId)": "\(attribute?.appUniqueId ?? "")",
            "\(CrashDataKeys.isForeground)": \(isForeground),
            "\(CrashDataKeys.sessionId)": "\(sessionId ?? "")"
        }
        """
    }

    private func getAttributes(crashData: [String: Any]) -> Attributes {
        let deviceTypeString = crashData[CrashDataKeys.deviceType] as? String ?? "phone"
        let deviceType = DeviceType(rawValue: deviceTypeString)
        let networkTypeString = crashData[CrashDataKeys.networkType] as? String ?? "unknown"
        let networkType = NetworkType(rawValue: networkTypeString)
        let networkGenerationString =  crashData[CrashDataKeys.networkGeneration] as? String ?? "unknown"
        let networkGeneration = NetworkGeneration(rawValue: networkGenerationString)
        return Attributes(threadName: crashData[CrashDataKeys.threadName] as? String,
                          deviceName: crashData[CrashDataKeys.deviceName] as? String,
                          deviceModel: crashData[CrashDataKeys.deviceModel] as? String,
                          deviceManufacturer: crashData[CrashDataKeys.deviceManufacturer] as? String,
                          deviceType: deviceType,
                          deviceIsFoldable: crashData[CrashDataKeys.deviceIsFoldable] as? Bool,
                          deviceIsPhysical: crashData[CrashDataKeys.deviceIsPhysical] as? Bool,
                          deviceDensityDpi: crashData[CrashDataKeys.deviceDensityDpi] as? Number,
                          deviceWidthPx: crashData[CrashDataKeys.deviceWidthPx] as? Number,
                          deviceHeightPx: crashData[CrashDataKeys.deviceHeightPx] as? Number,
                          deviceDensity: crashData[CrashDataKeys.deviceDensity] as? Number,
                          deviceLocale: crashData[CrashDataKeys.deviceLocale] as? String,
                          osName: crashData[CrashDataKeys.osName] as? String,
                          osVersion: crashData[CrashDataKeys.osVersion] as? String,
                          platform: crashData[CrashDataKeys.platform] as? String ?? "",
                          networkType: networkType,
                          networkGeneration: networkGeneration,
                          networkProvider: crashData[CrashDataKeys.networkProvider] as? String,
                          installationId: crashData[CrashDataKeys.installationId] as? String ?? "",
                          userId: crashData[CrashDataKeys.userId] as? String,
                          deviceCpuArch: crashData[CrashDataKeys.deviceCpuArch] as? String,
                          appVersion: crashData[CrashDataKeys.appVersion] as? String ?? "",
                          appBuild: crashData[CrashDataKeys.appBuild] as? String ?? "",
                          measureSdkVersion: crashData[CrashDataKeys.measureSdkVersion] as? String ?? "",
                          appUniqueId: crashData[CrashDataKeys.appUniqueId] as? String ?? "")
    }
}
