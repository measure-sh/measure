//
//  BuildEnvironment.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 10/11/26.
//

import Foundation

protocol BuildEnvironment {
    var isDebugBuild: Bool { get }
}

/// Detects a debug build at runtime, since the SDK may be compiled in release mode
/// even when the host app is a debug build.
///
/// The host app is treated as a debug build if any of the following is true:
/// - It is running on a simulator.
/// - A debugger is attached.
/// - Its provisioning profile allows debugging (`get-task-allow`), i.e. it is development signed.
final class BaseBuildEnvironment: BuildEnvironment {
    let isDebugBuild: Bool

    init(sysCtl: SysCtl,
         isSimulator: Bool = BaseBuildEnvironment.isSimulator,
         provisioningProfilePath: String? = Bundle.main.path(forResource: "embedded", ofType: "mobileprovision")) {
        self.isDebugBuild = isSimulator
            || sysCtl.isDebuggerAttached()
            || BaseBuildEnvironment.allowsDebugging(provisioningProfilePath: provisioningProfilePath)
    }

    static var isSimulator: Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return false
        #endif
    }

    /// Reads the `get-task-allow` entitlement from the provisioning profile.
    static func allowsDebugging(provisioningProfilePath: String?) -> Bool {
        guard let provisioningProfilePath,
              let data = FileManager.default.contents(atPath: provisioningProfilePath),
              let start = data.range(of: Data("<?xml".utf8)),
              let end = data.range(of: Data("</plist>".utf8), in: start.lowerBound..<data.endIndex) else {
            return false
        }

        let plistData = data.subdata(in: start.lowerBound..<end.upperBound)
        guard let plist = try? PropertyListSerialization.propertyList(from: plistData, format: nil) as? [String: Any],
              let entitlements = plist["Entitlements"] as? [String: Any] else {
            return false
        }

        return entitlements["get-task-allow"] as? Bool ?? false
    }
}
