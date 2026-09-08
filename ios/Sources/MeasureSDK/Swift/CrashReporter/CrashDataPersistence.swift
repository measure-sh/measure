//
//  CrashDataPersistence.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 19/09/24.
//

#if canImport(KSCrashRecording)
import KSCrashRecording
#elseif canImport(KSCrash)
import KSCrash
#endif
import Foundation

typealias CrashDataAttributes = (attribute: Attributes?, sessionId: String?, isForeground: Bool?)

private let crashReportUserSectionKey = "user"

protocol CrashDataPersistence {
    var attribute: Attributes? { get set }
    var sessionId: String? { get set }
    var isForeground: Bool { get set }

    func writeCrashData(plan: UnsafePointer<ExceptionHandlingPlan>, writer: UnsafePointer<ReportWriter>)
    func readCrashData(from reportDict: [String: Any]) -> CrashDataAttributes
}

final class BaseCrashDataPersistence: CrashDataPersistence {
    var attribute: Attributes? {
        didSet { updateBuffers(with: attribute) }
    }
    var sessionId: String? {
        didSet { sessionIdBuffer.update(sessionId) }
    }
    var isForeground: Bool

    private var threadNameBuffer = CrashDataBuffer()
    private var deviceNameBuffer = CrashDataBuffer()
    private var deviceModelBuffer = CrashDataBuffer()
    private var deviceManufacturerBuffer = CrashDataBuffer()
    private var deviceTypeBuffer = CrashDataBuffer()
    private var deviceLocaleBuffer = CrashDataBuffer()
    private var osNameBuffer = CrashDataBuffer()
    private var osVersionBuffer = CrashDataBuffer()
    private var networkTypeBuffer = CrashDataBuffer()
    private var networkGenerationBuffer = CrashDataBuffer()
    private var networkProviderBuffer = CrashDataBuffer()
    private var installationIdBuffer = CrashDataBuffer()
    private var userIdBuffer = CrashDataBuffer()
    private var deviceCpuArchBuffer = CrashDataBuffer()
    private var appVersionBuffer = CrashDataBuffer()
    private var appBuildBuffer = CrashDataBuffer()
    private var measureSdkVersionBuffer = CrashDataBuffer()
    private var appUniqueIdBuffer = CrashDataBuffer()
    private var sessionIdBuffer = CrashDataBuffer()

    init(attribute: Attributes? = nil, sessionId: String? = nil, isForeground: Bool = true) {
        self.attribute = attribute
        self.sessionId = sessionId
        self.isForeground = isForeground
        updateBuffers(with: attribute)
        sessionIdBuffer.update(sessionId)
    }

    private func updateBuffers(with attribute: Attributes?) {
        threadNameBuffer.update(attribute?.threadName)
        deviceNameBuffer.update(attribute?.deviceName)
        deviceModelBuffer.update(attribute?.deviceModel)
        deviceManufacturerBuffer.update(attribute?.deviceManufacturer)
        deviceTypeBuffer.update(attribute?.deviceType?.rawValue)
        deviceLocaleBuffer.update(attribute?.deviceLocale)
        osNameBuffer.update(attribute?.osName)
        osVersionBuffer.update(attribute?.osVersion)
        networkTypeBuffer.update(attribute?.networkType?.rawValue)
        networkGenerationBuffer.update(attribute?.networkGeneration?.rawValue)
        networkProviderBuffer.update(attribute?.networkProvider)
        installationIdBuffer.update(attribute?.installationId)
        userIdBuffer.update(attribute?.userId)
        deviceCpuArchBuffer.update(attribute?.deviceCpuArch)
        appVersionBuffer.update(attribute?.appVersion)
        appBuildBuffer.update(attribute?.appBuild)
        measureSdkVersionBuffer.update(attribute?.measureSdkVersion)
        appUniqueIdBuffer.update(attribute?.appUniqueId)
    }

    func writeCrashData(plan: UnsafePointer<ExceptionHandlingPlan>, writer: UnsafePointer<ReportWriter>) {
        // Per KSCrash's contract for `crashedDuringExceptionHandling`: record nothing extra
        // when a crash occurs while already handling another crash.
        guard !plan.pointee.crashedDuringExceptionHandling, attribute != nil else { return }

        threadNameBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.threadName, $0) }
        deviceNameBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.deviceName, $0) }
        deviceModelBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.deviceModel, $0) }
        deviceManufacturerBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.deviceManufacturer, $0) }
        deviceTypeBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.deviceType, $0) }
        deviceLocaleBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.deviceLocale, $0) }
        osNameBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.osName, $0) }
        osVersionBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.osVersion, $0) }
        networkTypeBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.networkType, $0) }
        networkGenerationBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.networkGeneration, $0) }
        networkProviderBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.networkProvider, $0) }
        installationIdBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.installationId, $0) }
        userIdBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.userId, $0) }
        deviceCpuArchBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.deviceCpuArch, $0) }
        appVersionBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.appVersion, $0) }
        appBuildBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.appBuild, $0) }
        measureSdkVersionBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.measureSdkVersion, $0) }
        appUniqueIdBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.appUniqueId, $0) }
        sessionIdBuffer.withCString { writer.pointee.addStringElement(writer, CrashDataKeys.sessionId, $0) }

        if let deviceIsFoldable = attribute?.deviceIsFoldable {
            writer.pointee.addBooleanElement(writer, CrashDataKeys.deviceIsFoldable, deviceIsFoldable)
        }
        if let deviceIsPhysical = attribute?.deviceIsPhysical {
            writer.pointee.addBooleanElement(writer, CrashDataKeys.deviceIsPhysical, deviceIsPhysical)
        }
        if let deviceDensityDpi = attribute?.deviceDensityDpi {
            writer.pointee.addIntegerElement(writer, CrashDataKeys.deviceDensityDpi, deviceDensityDpi)
        }
        if let deviceWidthPx = attribute?.deviceWidthPx {
            writer.pointee.addIntegerElement(writer, CrashDataKeys.deviceWidthPx, deviceWidthPx)
        }
        if let deviceHeightPx = attribute?.deviceHeightPx {
            writer.pointee.addIntegerElement(writer, CrashDataKeys.deviceHeightPx, deviceHeightPx)
        }
        if let deviceDensity = attribute?.deviceDensity {
            writer.pointee.addIntegerElement(writer, CrashDataKeys.deviceDensity, deviceDensity)
        }
        writer.pointee.addBooleanElement(writer, CrashDataKeys.isForeground, isForeground)
    }

    func readCrashData(from reportDict: [String: Any]) -> CrashDataAttributes {
        guard let crashData = reportDict[crashReportUserSectionKey] as? [String: Any] else {
            return (attribute: nil, sessionId: nil, isForeground: nil)
        }

        let sessionId = crashData[CrashDataKeys.sessionId] as? String ?? ""
        let isForeground = crashData[CrashDataKeys.isForeground] as? Bool
        let attributes = getAttributes(crashData: crashData)
        return (attribute: attributes, sessionId: sessionId, isForeground: isForeground)
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
