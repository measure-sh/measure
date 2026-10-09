//
//  MachOArch.swift
//  Measure
//
//  Created by Adwin Ross on 21/09/26.
//

import Foundation

/// Maps Mach-O CPU type and subtype to the architecture name reported in `BinaryImage.arch`.
enum MachOArch {
    static func resolve(cpuType: Int32, cpuSubType: Int32) -> String { // swiftlint:disable:this cyclomatic_complexity
        let subtype = cpuSubType & ~CPU_SUBTYPE_MASK_SIGNED

        switch cpuType {
        case CPU_TYPE_ARM:
            switch subtype {
            case CPU_SUBTYPE_ARM_V6:  return "armv6"
            case CPU_SUBTYPE_ARM_V7:  return "armv7"
            case CPU_SUBTYPE_ARM_V7S: return "armv7s"
            default:                  return "arm-unknown"
            }
        case CPU_TYPE_ARM64:
            switch subtype {
            case CPU_SUBTYPE_ARM64_ALL: return "arm64"
            case CPU_SUBTYPE_ARM64_V8:  return "armv8"
            case CPU_SUBTYPE_ARM64E:    return "arm64e"
            default:                    return "arm64-unknown"
            }
        case CPU_TYPE_X86:     return "i386"
        case CPU_TYPE_X86_64:  return "x86_64"
        case CPU_TYPE_POWERPC: return "powerpc"
        default:               return "???"
        }
    }

    /// `CPU_SUBTYPE_MASK` is `0xff000000` as a `UInt32`; the subtype fields are signed.
    private static let CPU_SUBTYPE_MASK_SIGNED = Int32(bitPattern: CPU_SUBTYPE_MASK) // swiftlint:disable:this identifier_name
}
