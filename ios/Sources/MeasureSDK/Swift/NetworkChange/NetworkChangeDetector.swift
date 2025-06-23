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
    func stop()
}

final class BaseNetworkChangeDetector: NetworkChangeDetector {
    private let monitor: NWPathMonitor
    private let queue: DispatchQueue
    private var previousNetworkChangeData: NetworkChangeData
    private var lastUpdateTime: Date?
    private let networkChangeCallback: NetworkChangeCallback
    private var isFirstUpdate = true

    init(networkChangeCallback: NetworkChangeCallback) {
        self.monitor = NWPathMonitor()
        self.queue = DispatchQueue.global(qos: .background)
        self.previousNetworkChangeData = NetworkChangeData(previousNetworkType: .unknown,
                                                           networkType: .unknown,
                                                           previousNetworkGeneration: .unknown,
                                                           networkGeneration: .unknown,
                                                           networkProvider: AttributeConstants.unknown)
        self.networkChangeCallback = networkChangeCallback
    }

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self = self else { return }

            let now = Date()
            if let lastUpdate = self.lastUpdateTime, now.timeIntervalSince(lastUpdate) < 1.0 {
                return
            }
            self.lastUpdateTime = now

            // Detect VPN
            if let networkType = self.detectVpnState() {
                self.handleNetworkChange(type: networkType)
                return
            }

            let networkType: NetworkType
            if path.status == .satisfied {
                if path.usesInterfaceType(.wifi) {
                    networkType = .wifi
                } else if path.usesInterfaceType(.cellular) {
                    networkType = .cellular
                } else {
                    networkType = .unknown
                }
            } else {
                networkType = .noNetwork
            }

            self.handleNetworkChange(type: networkType)
        }

        monitor.start(queue: queue)
    }

    func stop() {
        monitor.cancel()
    }

    private func handleNetworkChange(type newNetworkType: NetworkType) {
        if isFirstUpdate {
            previousNetworkChangeData = generateNetworkChangeData(newNetworkType)
            isFirstUpdate = false
            return
        }

        processNetworkChange(newNetworkType: newNetworkType)
    }

    private func processNetworkChange(newNetworkType: NetworkType) {
        guard newNetworkType != previousNetworkChangeData.networkType else { return }

        previousNetworkChangeData = generateNetworkChangeData(newNetworkType)
        networkChangeCallback.onNetworkChange(previousNetworkChangeData)
    }

    private func detectVpnState() -> NetworkType? {
        guard let cfDict = CFNetworkCopySystemProxySettings()?.takeRetainedValue() as? [String: Any],
              let scoped = cfDict["__SCOPED__"] as? [String: Any] else {
            return nil
        }

        if scoped.keys.contains(where: { $0.contains("tap") || $0.contains("tun") }) {
            return .vpn
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
        guard let carrierType = networkInfo.serviceCurrentRadioAccessTechnology?.first?.value else {
            return .unknown
        }

        if #available(iOS 14.1, *) {
            switch carrierType {
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
            switch carrierType {
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
