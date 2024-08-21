//
//  AttributeGenerator.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 19/08/24.
//

import SystemConfiguration
import CoreTelephony
import Foundation
import UIKit

/// A generator struct to create Attribute objects with auto-generated properties.
struct AttributeGenerator {
    static func generateAttribute(installationId: String, userId: String? = nil) -> Attribute {
        var threadName = ""
        if let queueLabel = String(validatingUTF8: __dispatch_queue_get_label(nil)) {
            threadName = queueLabel
        }
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
        let appBuild = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
        let appUniqueId = Bundle.main.bundleIdentifier ?? "Unknown"
        let deviceName = UIDevice.current.name
        let deviceModel = UIDevice.modelName
        let deviceManufacturer = "Apple"
        let deviceType = UIDevice.current.userInterfaceIdiom == .phone ? "phone" : "tablet"
        let deviceIsFoldable = false // iOS devices are not foldable yet
        let deviceIsPhysical = TARGET_OS_SIMULATOR == 0
        let deviceDensityDpi = Int(UIScreen.main.scale * 160) // DPI calculation
        let deviceWidthPx = Int(UIScreen.main.bounds.width * UIScreen.main.scale)
        let deviceHeightPx = Int(UIScreen.main.bounds.height * UIScreen.main.scale)
        let deviceDensity = Int(UIScreen.main.scale)
        let deviceLocale = Locale.current.identifier
        let osName = UIDevice.current.systemName
        let osVersion = UIDevice.current.systemVersion
        let measureSdkVersion = FrameworkInfo.version
        let networkType = getConnectionType()
        let networkProvider = getNetworkProvider()
        let networkGeneration = getNetworkGeneration()
        
        return Attribute(
            installationId: installationId,
            appVersion: appVersion,
            appBuild: appBuild,
            appUniqueId: appUniqueId, 
            platform: "ios",
            measureSdkVersion: measureSdkVersion,
            threadName: threadName,
            userId: userId,
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
            networkType: networkType,
            networkProvider: networkProvider,
            networkGeneration: networkGeneration
        )
    }
    
    private static func getConnectionType() -> String {
        guard let reachability = SCNetworkReachabilityCreateWithName(kCFAllocatorDefault, "www.google.com") else {
            return "no_network"
        }
        
        let cfDict = CFNetworkCopySystemProxySettings()
        let nsDict = cfDict!.takeRetainedValue() as NSDictionary
        if let keys = nsDict["__SCOPED__"] as? NSDictionary {
            if let allKeys = keys.allKeys as? [String] {
                for key in allKeys {
                    if (key == "tap" || 
                        key == "tun" ||
                        key == "ppp" ||
                        key == "ipsec" ||
                        key == "ipsec0" ||
                        key == "utun1" ||
                        key == "utun2") {
                        return "vpn"
                    }
                }
            }
        }
        
        var flags = SCNetworkReachabilityFlags()
        SCNetworkReachabilityGetFlags(reachability, &flags)
        
        let isReachable = flags.contains(.reachable)
        let isWWAN = flags.contains(.isWWAN)
        
        if isReachable {
            if isWWAN {
                let networkInfo = CTTelephonyNetworkInfo()
                let carrierType = networkInfo.serviceCurrentRadioAccessTechnology
                
                guard let _ = carrierType?.first?.value else {
                    return "unknown"
                }
                
                return "cellular"
            } else {
                return "wifi"
            }
        } else {
            return "no_network"
        }
    }
    
    private static func getNetworkProvider() -> String {
        let networkInfo = CTTelephonyNetworkInfo()
        guard let carrier = networkInfo.serviceSubscriberCellularProviders?.values.first else {
            return "unknown"
        }
        return carrier.carrierName == "--" ? "unknown" : (carrier.carrierName ?? "unknown")
    }
    
    private static func getNetworkGeneration() -> String {
        let networkInfo = CTTelephonyNetworkInfo()
        let carrierType = networkInfo.serviceCurrentRadioAccessTechnology
        
        guard let carrierTypeName = carrierType?.first?.value else {
            return "unknown"
        }
        
        if #available(iOS 14.1, *) {
            switch carrierTypeName {
            case CTRadioAccessTechnologyGPRS, CTRadioAccessTechnologyEdge, CTRadioAccessTechnologyCDMA1x:
                return "2g"
            case CTRadioAccessTechnologyLTE:
                return "4g"
            case CTRadioAccessTechnologyNRNSA, CTRadioAccessTechnologyNR:
                return "5g"
            default:
                return "3g"
            }
        } else {
            switch carrierTypeName {
            case CTRadioAccessTechnologyGPRS, CTRadioAccessTechnologyEdge, CTRadioAccessTechnologyCDMA1x:
                return "2g"
            case CTRadioAccessTechnologyLTE:
                return "4g"
            default:
                return "3g"
            }
        }
    }
}
