//
//  TestDataGenerator.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 22/10/24.
//

import Foundation
@testable import Measure

struct TestDataGenerator {
    static func generateAttributes(
        threadName: String = "main",
        deviceName: String = "iPhone",
        deviceModel: String = "iPhone 14 Pro",
        deviceManufacturer: String = "Apple",
        deviceType: DeviceType = .phone,
        deviceIsFoldable: Bool = false,
        deviceIsPhysical: Bool = true,
        deviceDensityDpi: Number = 460,
        deviceWidthPx: Number = 1170,
        deviceHeightPx: Number = 2532,
        deviceDensity: Number = 3,
        deviceLocale: String = "en_US",
        osName: String = "iOS",
        osVersion: String = "17.0",
        platform: String = "ios",
        networkType: NetworkType = .wifi,
        networkGeneration: NetworkGeneration = .generation5,
        networkProvider: String = "Verizon",
        installationId: String = "installation-id",
        userId: String = "user123",
        deviceCpuArch: String = "arm64e",
        appVersion: String = "1.2.3",
        appBuild: String = "123",
        measureSdkVersion: String = "0.0.1",
        appUniqueId: String = "unique-id"
    ) -> Attributes {
        return Attributes(
            threadName: threadName,
            deviceName: deviceName,
            deviceModel: deviceModel,
            deviceManufacturer: deviceManufacturer,
            deviceType: deviceType,
            deviceIsFoldable: deviceIsFoldable,
            deviceIsPhysical: deviceIsPhysical,
            deviceDensityDpi: deviceDensityDpi,
            deviceWidthPx: deviceWidthPx,
            deviceHeightPx: deviceHeightPx,
            deviceDensity: deviceDensity,
            deviceLocale: deviceLocale,
            osName: osName,
            osVersion: osVersion,
            platform: platform,
            networkType: networkType,
            networkGeneration: networkGeneration,
            networkProvider: networkProvider,
            installationId: installationId,
            userId: userId,
            deviceCpuArch: deviceCpuArch,
            appVersion: appVersion,
            appBuild: appBuild,
            measureSdkVersion: measureSdkVersion,
            appUniqueId: appUniqueId
        )
    }

    static func generateEvents(
        id: String = "event1",
        sessionId: String = "session1",
        timestamp: String = "2024-09-25T12:34:56Z",
        type: String = "click",
        exception: Data? = nil,
        attachments: Data? = nil,
        attributes: Data? = nil,
        userDefinedAttributes: String? = nil,
        gestureClick: Data? = nil,
        gestureLongClick: Data? = nil,
        gestureScroll: Data? = nil,
        userTriggered: Bool = true,
        attachmentSize: Number = 200,
        timestampInMillis: Number = 1727272496000,
        batchId: String? = nil,
        lifecycleApp: Data? = nil,
        lifecycleViewController: Data? = nil,
        lifecycleSwiftUI: Data? = nil,
        cpuUsage: Data? = nil,
        memoryUsage: Data? = nil,
        coldLaunch: Data? = nil,
        warmLaunch: Data? = nil,
        hotLaunch: Data? = nil,
        http: Data? = nil,
        customEvent: Data? = nil,
        networkChange: Data? = nil,
        screenView: Data? = nil,
        bugReport: Data? = nil,
        needsReporting: Bool = true) -> EventEntity {
        return EventEntity(
            id: id,
            sessionId: sessionId,
            timestamp: timestamp,
            type: type,
            exception: exception,
            attachments: attachments,
            attributes: attributes,
            userDefinedAttributes: userDefinedAttributes,
            gestureClick: gestureClick,
            gestureLongClick: gestureLongClick,
            gestureScroll: gestureScroll,
            userTriggered: userTriggered,
            attachmentSize: attachmentSize,
            timestampInMillis: timestampInMillis,
            batchId: batchId,
            lifecycleApp: lifecycleApp,
            lifecycleViewController: lifecycleViewController,
            lifecycleSwiftUI: lifecycleSwiftUI,
            cpuUsage: cpuUsage,
            memoryUsage: memoryUsage,
            coldLaunch: coldLaunch,
            warmLaunch: warmLaunch,
            hotLaunch: hotLaunch,
            http: http,
            networkChange: networkChange,
            customEvent: customEvent,
            screenView: screenView,
            bugReport: bugReport,
            needsReporting: needsReporting
        )
    }

    static func generateSpans(
        name: String? = "ViewController.viewDidLoad",
        traceId: String? = "trace-id-123",
        spanId: String = "span-id-123",
        parentId: String? = nil,
        sessionId: String? = "session-id-123",
        startTime: Int64 = 1727272496000,
        startTimeString: String = "2024-09-25T12:34:56Z",
        endTime: Int64 = 1727272496200,
        endTimeString: String = "2024-09-25T12:34:58Z",
        duration: Int64 = 200,
        status: Int64? = 0,
        attributes: Data? = nil,
        userDefinedAttrs: Data? = nil,
        checkpoints: Data? = nil,
        hasEnded: Bool = true,
        isSampled: Bool = true,
        batchId: String? = nil
    ) -> SpanEntity {
        return SpanEntity(
            name: name,
            traceId: traceId,
            spanId: spanId,
            parentId: parentId,
            sessionId: sessionId,
            startTime: startTime,
            startTimeString: startTimeString,
            endTime: endTime,
            endTimeString: endTimeString,
            duration: duration,
            status: status,
            attributes: attributes,
            userDefinedAttrs: userDefinedAttrs,
            checkpoints: checkpoints,
            hasEnded: hasEnded,
            isSampled: isSampled,
            batchId: batchId
        )
    }
}
