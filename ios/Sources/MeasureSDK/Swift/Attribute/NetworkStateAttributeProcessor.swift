//
//  NetworkStateAttributeProcessor.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 03/09/24.
//

import SystemConfiguration
import CoreTelephony
import Foundation

/// Generates the network state attributes. These attributes are expected to change during the session.
/// This class computes the attributes every time appendAttributes is called.
final class NetworkStateAttributeProcessor: AttributeProcessor {
    private var cachedAttributes: (type: NetworkType, gen: NetworkGeneration, provider: String)?
    private var lastUpdateTime: Date?
    private let measureDispatchQueue: MeasureDispatchQueue

    init(measureDispatchQueue: MeasureDispatchQueue) {
        self.measureDispatchQueue = measureDispatchQueue
    }

    func appendAttributes(_ attributes: inout Attributes) {
        if let cache = cachedAttributes {
            attributes.networkType = cache.type
            attributes.networkGeneration = cache.gen
            attributes.networkProvider = cache.provider
        }

        measureDispatchQueue.submit { [weak self] in
            guard let self else { return }
            if shouldUpdateCache() {
                cachedAttributes = (
                    type: getNetworkType(),
                    gen: getNetworkGeneration(),
                    provider: getNetworkProvider()
                )
                lastUpdateTime = Date()
            }
        }
    }

    private func shouldUpdateCache() -> Bool {
        guard let last = lastUpdateTime else { return true }
        return Date().timeIntervalSince(last) > 10
    }

    private func getNetworkType() -> NetworkType {
        guard let reachability = SCNetworkReachabilityCreateWithName(kCFAllocatorDefault, "www.google.com") else {
            return .noNetwork
        }

        let cfDict = CFNetworkCopySystemProxySettings()
        let nsDict = cfDict!.takeRetainedValue() as NSDictionary
        if let keys = nsDict["__SCOPED__"] as? NSDictionary {
            if let allKeys = keys.allKeys as? [String] {
                for key in allKeys where (key == "tap" ||
                                          key == "tun" ||
                                          key == "ppp" ||
                                          key == "ipsec" ||
                                          key == "ipsec0" ||
                                          key == "utun1" ||
                                          key == "utun2") {
                    return .vpn
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

                guard carrierType?.first?.value != nil else {
                    return .unknown
                }

                return .cellular
            } else {
                return .wifi
            }
        } else {
            return .noNetwork
        }
    }

    private func getNetworkProvider() -> String {
        let networkInfo = CTTelephonyNetworkInfo()
        guard let carrier = networkInfo.serviceSubscriberCellularProviders?.values.first else {
            return AttributeConstants.unknown
        }
        return carrier.carrierName == "--" ? AttributeConstants.unknown : (carrier.carrierName ?? AttributeConstants.unknown)
    }

    private func getNetworkGeneration() -> NetworkGeneration {
        let networkInfo = CTTelephonyNetworkInfo()
        let carrierType = networkInfo.serviceCurrentRadioAccessTechnology

        guard let carrierTypeName = carrierType?.first?.value else {
            return .unknown
        }

        if #available(iOS 14.1, *) {
            switch carrierTypeName {
            case CTRadioAccessTechnologyGPRS, CTRadioAccessTechnologyEdge, CTRadioAccessTechnologyCDMA1x:
                return .generation2
            case CTRadioAccessTechnologyLTE:
                return .generation4
            case CTRadioAccessTechnologyNRNSA, CTRadioAccessTechnologyNR:
                return .generation5
            default:
                return .generation3
            }
        } else {
            switch carrierTypeName {
            case CTRadioAccessTechnologyGPRS, CTRadioAccessTechnologyEdge, CTRadioAccessTechnologyCDMA1x:
                return .generation2
            case CTRadioAccessTechnologyLTE:
                return .generation4
            default:
                return .generation3
            }
        }
    }
}
