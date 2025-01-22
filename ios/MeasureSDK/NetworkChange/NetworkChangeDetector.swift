//
//  NetworkChangeDetector.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 22/12/24.
//

import CoreTelephony
import Foundation
import Network
import SystemConfiguration

protocol NetworkChangeDetector {
    func start()
}

final class BaseNetworkChangeDetector: NetworkChangeDetector {
    private let monitor: NWPathMonitor
    private let queue: DispatchQueue
    private var previousNetworkChangeData: NetworkChangeData
    private var lastUpdateTime: Date?
    private let networkChangeCallback: NetworkChangeCallback

    init(networkChangeCallback: NetworkChangeCallback) {
        monitor = NWPathMonitor()
        queue = DispatchQueue.global(qos: .background)
        previousNetworkChangeData = NetworkChangeData(previousNetworkType: .unknown,
                                                      networkType: .unknown,
                                                      previousNetworkGeneration: .unknown,
                                                      networkGeneration: .unknown,
                                                      networkProvider: AttributeConstants.unknown)
        self.networkChangeCallback = networkChangeCallback
    }

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self = self else { return }

            // Only update once every second
            let now = Date()
            if let lastUpdateTime = self.lastUpdateTime, now.timeIntervalSince(lastUpdateTime) < 1.0 {
                return
            }
            self.lastUpdateTime = now

            // Detect VPN
            if let networkType = self.detectVpnState() {
                self.processNetworkChange(newNetworkType: networkType)
                return
            }

            // Normal connectivity states
            if path.status == .satisfied {
                if path.usesInterfaceType(.wifi) {
                    self.processNetworkChange(newNetworkType: .wifi)
                } else if path.usesInterfaceType(.cellular) {
                    self.processNetworkChange(newNetworkType: .cellular)
                } else {
                    self.processNetworkChange(newNetworkType: .unknown)
                }
            } else {
                self.processNetworkChange(newNetworkType: .noNetwork)
            }
        }

        monitor.start(queue: queue)
    }

    private func processNetworkChange(newNetworkType: NetworkType) {
        if newNetworkType != previousNetworkChangeData.networkType {
            previousNetworkChangeData = generateNetworkChangeData(newNetworkType)
            networkChangeCallback.onNetworkChange(previousNetworkChangeData)
        }
    }

    func detectVpnState() -> NetworkType? {
        let cfDict = CFNetworkCopySystemProxySettings()
        let nsDict = cfDict!.takeRetainedValue() as NSDictionary
        if let keys = nsDict["__SCOPED__"] as? NSDictionary {
            if keys.allKeys.contains(where: { $0 as? String == "tap" || $0 as? String == "tun" }) {
                return .vpn
            }
        }

        return nil
    }

    private func generateNetworkChangeData(_ networkType: NetworkType) -> NetworkChangeData {
        return NetworkChangeData(previousNetworkType: previousNetworkChangeData.networkType,
                                 networkType: networkType,
                                 previousNetworkGeneration: previousNetworkChangeData.networkGeneration,
                                 networkGeneration: getNetworkGeneration(),
                                 networkProvider: getNetworkProvider())
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

    deinit {
        monitor.cancel()
    }
}
