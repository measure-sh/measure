//
//  CrashDataFormatterTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 12/03/26.
//

import XCTest
@testable import Measure

final class CrashDataFormatterTests: XCTestCase {
    private func makeReport(error: [String: Any] = [:],
                            threads: [[String: Any]] = [],
                            binaryImages: [[String: Any]] = [],
                            system: [String: Any] = [:]) -> [String: Any] {
        [
            "crash": [
                "error": error,
                "threads": threads
            ] as [String: Any],
            "binary_images": binaryImages,
            "system": system
        ]
    }

    private func makeFormatter(error: [String: Any] = [:],
                               threads: [[String: Any]] = [],
                               binaryImages: [[String: Any]] = [],
                               system: [String: Any] = [:]) -> CrashDataFormatter {
        CrashDataFormatter(makeReport(error: error, threads: threads,
                                      binaryImages: binaryImages, system: system))
    }

    private func makeImage(addr: UInt64 = 0x1000,
                           size: UInt64 = 0x100,
                           name: String = "/path/to/App",
                           cpuType: UInt64 = UInt64(bitPattern: Int64(CPU_TYPE_ARM64)),
                           cpuSubtype: UInt64 = UInt64(bitPattern: Int64(CPU_SUBTYPE_ARM64_ALL)),
                           uuid: String = "550E8400-E29B-41D4-A716-446655440000") -> [String: Any] {
        [
            "image_addr": addr,
            "image_size": size,
            "name": name,
            "cpu_type": cpuType,
            "cpu_subtype": cpuSubtype,
            "uuid": uuid
        ]
    }

    private func makeFrame(instrAddr: UInt64 = 0x2000,
                           objAddr: UInt64 = 0x1000,
                           symAddr: UInt64 = 0x1F00,
                           objName: String = "App",
                           symName: String = "someFunc") -> [String: Any] {
        [
            "instruction_addr": instrAddr,
            "object_addr": objAddr,
            "symbol_addr": symAddr,
            "object_name": objName,
            "symbol_name": symName
        ]
    }

    private func makeThreadDict(index: Int = 0,
                                crashed: Any = false,
                                name: String? = nil,
                                frames: [[String: Any]] = []) -> [String: Any] {
        var dictionary: [String: Any] = [
            "index": index,
            "crashed": crashed,
            "backtrace": ["contents": frames]
        ]
        if let name { dictionary["name"] = name }
        return dictionary
    }

    func test_parseExceptionName_returnsNSExceptionName() {
        let sut = makeFormatter(error: ["nsexception": ["name": "NSInvalidArgumentException"]])
        XCTAssertEqual(sut.parseExceptionName(), "NSInvalidArgumentException")
    }

    func test_parseExceptionName_fallsBackToMachExceptionName() {
        let sut = makeFormatter(error: ["mach": ["exception_name": "EXC_BAD_ACCESS"]])
        XCTAssertEqual(sut.parseExceptionName(), "EXC_BAD_ACCESS")
    }

    func test_parseExceptionName_fallsBackToSignalName() {
        let sut = makeFormatter(error: ["signal": ["name": "SIGSEGV"]])
        XCTAssertEqual(sut.parseExceptionName(), "SIGSEGV")
    }

    func test_parseExceptionName_returnsEmptyStringWhenNothingPresent() {
        let sut = makeFormatter()
        XCTAssertEqual(sut.parseExceptionName(), "")
    }

    func test_parseExceptionReason_returnsNSExceptionReason() {
        let sut = makeFormatter(error: ["nsexception": ["reason": "reason from ns"]])
        XCTAssertEqual(sut.parseExceptionReason(), "reason from ns")
    }

    func test_parseExceptionReason_returnsCppExceptionReason() {
        let sut = makeFormatter(error: ["cpp_exception": ["reason": "std::bad_alloc"]])
        XCTAssertEqual(sut.parseExceptionReason(), "std::bad_alloc")
    }

    func test_parseExceptionReason_returnsMachCodeName() {
        let sut = makeFormatter(error: ["mach": ["code_name": "KERN_INVALID_ADDRESS"]])
        XCTAssertEqual(sut.parseExceptionReason(), "KERN_INVALID_ADDRESS")
    }

    func test_parseExceptionReason_appendsSubcodeToMachReason() {
        let sut = makeFormatter(error: ["mach": ["code_name": "KERN_INVALID_ADDRESS", "subcode": 42]])
        XCTAssertEqual(sut.parseExceptionReason(), "KERN_INVALID_ADDRESS, subcode: 42")
    }

    func test_parseExceptionReason_returnsFallbackReasonString() {
        let sut = makeFormatter(error: ["reason": "generic reason"])
        XCTAssertEqual(sut.parseExceptionReason(), "generic reason")
    }

    func test_parseExceptionReason_returnsEmptyWhenNothingPresent() {
        let sut = makeFormatter()
        XCTAssertEqual(sut.parseExceptionReason(), "")
    }

    func test_parseSignalName_returnsSignalName() {
        let sut = makeFormatter(error: ["signal": ["name": "SIGABRT"]])
        XCTAssertEqual(sut.parseSignalName(), "SIGABRT")
    }

    func test_parseSignalName_returnsEmptyStringWhenMissing() {
        let sut = makeFormatter()
        XCTAssertEqual(sut.parseSignalName(), "")
    }

    func test_parseOsBuildNumber_returnsOsVersion() {
        let sut = makeFormatter(system: ["os_version": "iPhone OS 17.0 (21A329)"])
        XCTAssertEqual(sut.parseOsBuildNumber(), "iPhone OS 17.0 (21A329)")
    }

    func test_parseOsBuildNumber_returnsEmptyStringWhenMissing() {
        let sut = makeFormatter()
        XCTAssertEqual(sut.parseOsBuildNumber(), "")
    }

    func test_parseForeground_returnsTrueWhenBoolTrue() {
        let sut = makeFormatter(system: ["application_stats": ["application_in_foreground": true]])
        XCTAssertEqual(sut.parseForeground(), true)
    }

    func test_parseForeground_returnsFalseWhenBoolFalse() {
        let sut = makeFormatter(system: ["application_stats": ["application_in_foreground": false]])
        XCTAssertEqual(sut.parseForeground(), false)
    }

    func test_parseForeground_returnsTrueWhenIntOne() {
        let sut = makeFormatter(system: ["application_stats": ["application_in_foreground": 1]])
        XCTAssertEqual(sut.parseForeground(), true)
    }

    func test_parseForeground_returnsFalseWhenIntZero() {
        let sut = makeFormatter(system: ["application_stats": ["application_in_foreground": 0]])
        XCTAssertEqual(sut.parseForeground(), false)
    }

    func test_parseForeground_returnsNilWhenApplicationStatsMissing() {
        let sut = makeFormatter()
        XCTAssertNil(sut.parseForeground())
    }

    func test_parseThread_returnsCorrectSequence() {
        let sut = makeFormatter()
        let result = sut.parseThread(makeThreadDict(index: 3))
        XCTAssertEqual(result.sequence, 3)
    }

    func test_parseThread_usesNameFromDict() {
        let sut = makeFormatter()
        let result = sut.parseThread(makeThreadDict(name: "com.apple.main-thread"))
        XCTAssertEqual(result.name, "com.apple.main-thread")
    }

    func test_parseThread_generatesCrashedNameWhenNoName() {
        let sut = makeFormatter()
        let result = sut.parseThread(makeThreadDict(index: 2, crashed: true))
        XCTAssertEqual(result.name, "Thread 2 Crashed")
    }

    func test_parseThread_generatesThreadNameWhenNotCrashedAndNoName() {
        let sut = makeFormatter()
        let result = sut.parseThread(makeThreadDict(index: 5, crashed: false))
        XCTAssertEqual(result.name, "Thread 5")
    }

    func test_parseThread_crashedTrueWhenBoolTrue() {
        let sut = makeFormatter()
        let result = sut.parseThread(makeThreadDict(index: 0, crashed: true))
        XCTAssertTrue(result.name.contains("Crashed"))
    }

    func test_parseThread_crashedTrueWhenIntOne() {
        let sut = makeFormatter()
        let result = sut.parseThread(makeThreadDict(index: 0, crashed: 1))
        XCTAssertTrue(result.name.contains("Crashed"))
    }

    func test_parseThread_returnsEmptyFramesWhenBacktraceMissing() {
        let sut = makeFormatter()
        var dict = makeThreadDict()
        dict.removeValue(forKey: "backtrace")
        let result = sut.parseThread(dict)
        XCTAssertTrue(result.frames.isEmpty)
    }

    func test_parseFrames_returnsEmptyWhenBacktraceMissing() {
        let sut = makeFormatter()
        let result = sut.parseFrames([:])
        XCTAssertTrue(result.isEmpty)
    }

    func test_parseFrames_returnsEmptyWhenContentsMissing() {
        let sut = makeFormatter()
        let result = sut.parseFrames(["backtrace": [:]])
        XCTAssertTrue(result.isEmpty)
    }

    func test_parseFrames_returnsCorrectNumberOfFrames() {
        let sut = makeFormatter()
        let frames = [makeFrame(), makeFrame(), makeFrame()]
        let thread = makeThreadDict(frames: frames)
        let result = sut.parseFrames(thread)
        XCTAssertEqual(result.count, 3)
    }

    func test_parseFrames_frameIndicesAreSequentialFromZero() {
        let sut = makeFormatter()
        let frames = [makeFrame(), makeFrame(), makeFrame()]
        let thread = makeThreadDict(frames: frames)
        let result = sut.parseFrames(thread)
        XCTAssertEqual(result[0].frameIndex, 0)
        XCTAssertEqual(result[1].frameIndex, 1)
        XCTAssertEqual(result[2].frameIndex, 2)
    }

    func test_parseFrame_setsBinaryNameFromObjectName() {
        let sut = makeFormatter()
        let result = sut.parseFrame(makeFrame(objName: "MyBinary"), index: 0)
        XCTAssertEqual(result.binaryName, "MyBinary")
    }

    func test_parseFrame_setsBinaryAddressAsHexFromObjectAddr() {
        let sut = makeFormatter()
        let result = sut.parseFrame(makeFrame(objAddr: 0x1000), index: 0)
        XCTAssertEqual(result.binaryAddress, "0000000000001000")
    }

    func test_parseFrame_setsSymbolAddressAsHexFromSymbolAddr() {
        let sut = makeFormatter()
        let result = sut.parseFrame(makeFrame(instrAddr: 0x1F00), index: 0)
        XCTAssertEqual(result.symbolAddress, "0000000000001f00")
    }

    func test_parseFrame_calculatesOffsetAsInstrAddrMinusSymbolAddr() {
        let sut = makeFormatter()
        let result = sut.parseFrame(makeFrame(instrAddr: 0x2000, symAddr: 0x1F00), index: 0)
        XCTAssertEqual(result.offset, 0x100)
    }

    func test_parseFrame_setsOffsetToNilWhenSymbolAddrMissing() {
        let sut = makeFormatter()
        var frame = makeFrame()
        frame.removeValue(forKey: "symbol_addr")
        let result = sut.parseFrame(frame, index: 0)
        XCTAssertNil(result.offset)
    }

    func test_parseFrame_setsInAppTrueForAppBinary() {
        let sut = makeFormatter()
        let result = sut.parseFrame(makeFrame(objName: "MyApp.debug.dylib"), index: 0)
        XCTAssertEqual(result.inApp, true)
    }

    func test_parseFrame_setsInAppFalseForSystemBinary() {
        let sut = makeFormatter()
        let result = sut.parseFrame(makeFrame(objName: "UIKitCore"), index: 0)
        XCTAssertEqual(result.inApp, false)
    }

    func test_parseUUID_stripsHyphens() {
        let sut = makeFormatter()
        let result = sut.parseUUID(["uuid": "550E8400-E29B-41D4-A716-446655440000"])
        XCTAssertFalse(result.contains("-"))
    }

    func test_parseUUID_lowercasesResult() {
        let sut = makeFormatter()
        let result = sut.parseUUID(["uuid": "550E8400-E29B-41D4-A716-446655440000"])
        XCTAssertEqual(result, result.lowercased())
    }

    func test_parseUUID_returnsFallbackWhenMissing() {
        let sut = makeFormatter()
        let result = sut.parseUUID([:])
        XCTAssertEqual(result, "uuid")
    }

    func test_resolveIsLp64_returnsFalseForARM() {
        let sut = makeFormatter()
        let imgs = [["cpu_type": UInt64(bitPattern: Int64(CPU_TYPE_ARM))]]
        XCTAssertFalse(sut.resolveIsLp64(binaryImageDicts: imgs))
    }

    func test_resolveIsLp64_returnsTrueForARM64() {
        let sut = makeFormatter()
        let imgs = [["cpu_type": UInt64(bitPattern: Int64(CPU_TYPE_ARM64))]]
        XCTAssertTrue(sut.resolveIsLp64(binaryImageDicts: imgs))
    }

    func test_resolveIsLp64_returnsFalseForX86() {
        let sut = makeFormatter()
        let imgs = [["cpu_type": UInt64(bitPattern: Int64(CPU_TYPE_X86))]]
        XCTAssertFalse(sut.resolveIsLp64(binaryImageDicts: imgs))
    }

    func test_resolveIsLp64_returnsTrueForX86_64() {
        let sut = makeFormatter()
        let imgs = [["cpu_type": UInt64(bitPattern: Int64(CPU_TYPE_X86_64))]]
        XCTAssertTrue(sut.resolveIsLp64(binaryImageDicts: imgs))
    }

    func test_resolveIsLp64_returnsFalseForPowerPC() {
        let sut = makeFormatter()
        let imgs = [["cpu_type": UInt64(bitPattern: Int64(CPU_TYPE_POWERPC))]]
        XCTAssertFalse(sut.resolveIsLp64(binaryImageDicts: imgs))
    }

    func test_resolveIsLp64_returnsTrueByDefaultWhenNoCpuType() {
        let sut = makeFormatter()
        XCTAssertTrue(sut.resolveIsLp64(binaryImageDicts: [[:]]))
    }

    func test_resolveIsLp64_usesFirstImage() {
        let sut = makeFormatter()
        let imgs: [[String: Any]] = [
            ["cpu_type": UInt64(bitPattern: Int64(CPU_TYPE_ARM))],
            ["cpu_type": UInt64(bitPattern: Int64(CPU_TYPE_ARM64))]
        ]
        XCTAssertFalse(sut.resolveIsLp64(binaryImageDicts: imgs))
    }

    func test_resolveArch_arm64_all() {
        let sut = makeFormatter()
        let img: [String: Any] = [
            "cpu_type":    UInt64(bitPattern: Int64(CPU_TYPE_ARM64)),
            "cpu_subtype": UInt64(bitPattern: Int64(CPU_SUBTYPE_ARM64_ALL))
        ]
        XCTAssertEqual(sut.resolveArch(img), "arm64")
    }

    func test_resolveArch_arm64e() {
        let sut = makeFormatter()
        let img: [String: Any] = [
            "cpu_type":    UInt64(bitPattern: Int64(CPU_TYPE_ARM64)),
            "cpu_subtype": UInt64(bitPattern: Int64(CPU_SUBTYPE_ARM64E))
        ]
        XCTAssertEqual(sut.resolveArch(img), "arm64e")
    }

    func test_resolveArch_armv8() {
        let sut = makeFormatter()
        let img: [String: Any] = [
            "cpu_type":    UInt64(bitPattern: Int64(CPU_TYPE_ARM64)),
            "cpu_subtype": UInt64(bitPattern: Int64(CPU_SUBTYPE_ARM64_V8))
        ]
        XCTAssertEqual(sut.resolveArch(img), "armv8")
    }

    func test_resolveArch_arm64Unknown() {
        let sut = makeFormatter()
        let img: [String: Any] = [
            "cpu_type":    UInt64(bitPattern: Int64(CPU_TYPE_ARM64)),
            "cpu_subtype": UInt64(0xDEAD)
        ]
        XCTAssertEqual(sut.resolveArch(img), "arm64-unknown")
    }

    func test_resolveArch_armv6() {
        let sut = makeFormatter()
        let img: [String: Any] = [
            "cpu_type":    UInt64(bitPattern: Int64(CPU_TYPE_ARM)),
            "cpu_subtype": UInt64(bitPattern: Int64(CPU_SUBTYPE_ARM_V6))
        ]
        XCTAssertEqual(sut.resolveArch(img), "armv6")
    }

    func test_resolveArch_armv7() {
        let sut = makeFormatter()
        let img: [String: Any] = [
            "cpu_type":    UInt64(bitPattern: Int64(CPU_TYPE_ARM)),
            "cpu_subtype": UInt64(bitPattern: Int64(CPU_SUBTYPE_ARM_V7))
        ]
        XCTAssertEqual(sut.resolveArch(img), "armv7")
    }

    func test_resolveArch_armv7s() {
        let sut = makeFormatter()
        let img: [String: Any] = [
            "cpu_type":    UInt64(bitPattern: Int64(CPU_TYPE_ARM)),
            "cpu_subtype": UInt64(bitPattern: Int64(CPU_SUBTYPE_ARM_V7S))
        ]
        XCTAssertEqual(sut.resolveArch(img), "armv7s")
    }

    func test_resolveArch_armUnknown() {
        let sut = makeFormatter()
        let img: [String: Any] = [
            "cpu_type":    UInt64(bitPattern: Int64(CPU_TYPE_ARM)),
            "cpu_subtype": UInt64(0xDEAD)
        ]
        XCTAssertEqual(sut.resolveArch(img), "arm-unknown")
    }

    func test_resolveArch_x86() {
        let sut = makeFormatter()
        let img: [String: Any] = ["cpu_type": UInt64(bitPattern: Int64(CPU_TYPE_X86))]
        XCTAssertEqual(sut.resolveArch(img), "i386")
    }

    func test_resolveArch_x86_64() {
        let sut = makeFormatter()
        let img: [String: Any] = ["cpu_type": UInt64(bitPattern: Int64(CPU_TYPE_X86_64))]
        XCTAssertEqual(sut.resolveArch(img), "x86_64")
    }

    func test_resolveArch_powerpc() {
        let sut = makeFormatter()
        let img: [String: Any] = ["cpu_type": UInt64(bitPattern: Int64(CPU_TYPE_POWERPC))]
        XCTAssertEqual(sut.resolveArch(img), "powerpc")
    }

    func test_resolveArch_unknownCpuType() {
        let sut = makeFormatter()
        XCTAssertEqual(sut.resolveArch([:]), "???")
    }

    func test_parseBinaryImages_returnsOnlyRelevantImages() {
        let objAddr: UInt64 = 0x1000
        let frame = makeFrame(objAddr: objAddr)
        let thread = makeThreadDict(crashed: true, frames: [frame])
        let relevantImg = makeImage(addr: objAddr, name: "/App")
        let irrelevantImg = makeImage(addr: 0x9999, name: "/Other")

        let sut = makeFormatter(threads: [thread], binaryImages: [relevantImg, irrelevantImg])
        let parsed = sut.parseBinaryImages(threads: [sut.parseThread(thread)])

        XCTAssertEqual(parsed?.count, 1)
    }

    func test_parseBinaryImages_deduplicatesImagesWithSameBaseAddress() {
        let addr: UInt64 = 0x1000
        let frame = makeFrame(objAddr: addr)
        let thread = makeThreadDict(crashed: true, frames: [frame])
        let img1 = makeImage(addr: addr, name: "/App")
        let img2 = makeImage(addr: addr, name: "/App")

        let sut = makeFormatter(threads: [thread], binaryImages: [img1, img2])
        let parsed = sut.parseBinaryImages(threads: [sut.parseThread(thread)])

        XCTAssertEqual(parsed?.count, 1)
    }

    func test_parseBinaryImages_setsSystemFalseForAppBinary() {
        let addr: UInt64 = 0x1000
        let frame = makeFrame(objAddr: addr)
        let thread = makeThreadDict(crashed: true, frames: [frame])
        let img = makeImage(addr: addr, name: "/App/MyApp.debug.dylib")

        let sut = makeFormatter(threads: [thread], binaryImages: [img])
        let parsed = sut.parseBinaryImages(threads: [sut.parseThread(thread)])

        XCTAssertEqual(parsed?.first?.system, false)
    }

    func test_parseBinaryImages_setsSystemTrueForSystemBinary() {
        let addr: UInt64 = 0x1000
        let frame = makeFrame(objAddr: addr)
        let thread = makeThreadDict(crashed: true, frames: [frame])
        let img = makeImage(addr: addr, name: "/usr/lib/libobjc.A.dylib")

        let sut = makeFormatter(threads: [thread], binaryImages: [img])
        let parsed = sut.parseBinaryImages(threads: [sut.parseThread(thread)])

        XCTAssertEqual(parsed?.first?.system, true)
    }

    func test_parseBinaryImages_normalizesUUID() {
        let addr: UInt64 = 0x1000
        let frame = makeFrame(objAddr: addr)
        let thread = makeThreadDict(crashed: true, frames: [frame])
        let img = makeImage(addr: addr, uuid: "550E8400-E29B-41D4-A716-446655440000")

        let sut = makeFormatter(threads: [thread], binaryImages: [img])
        let parsed = sut.parseBinaryImages(threads: [sut.parseThread(thread)])

        XCTAssertEqual(parsed?.first?.uuid, "550e8400e29b41d4a716446655440000")
    }

    func test_parseBinaryImages_setsCorrectStartAndEndAddress() {
        let addr: UInt64 = 0x1000
        let size: UInt64 = 0x200
        let frame = makeFrame(objAddr: addr)
        let thread = makeThreadDict(crashed: true, frames: [frame])
        let img = makeImage(addr: addr, size: size)

        let sut = makeFormatter(threads: [thread], binaryImages: [img])
        let parsed = sut.parseBinaryImages(threads: [sut.parseThread(thread)])

        XCTAssertEqual(parsed?.first?.startAddress, String(format: "%016llx", addr))
        XCTAssertEqual(parsed?.first?.endAddress,   String(format: "%016llx", addr + size))
    }

    func test_parseBinaryImages_returnsNilWhenNoRelevantImages() {
        let thread = makeThreadDict(crashed: true, frames: [makeFrame(objAddr: 0x1000)])
        let img = makeImage(addr: 0x9999)

        let sut = makeFormatter(threads: [thread], binaryImages: [img])
        let parsed = sut.parseBinaryImages(threads: [sut.parseThread(thread)])

        XCTAssertNil(parsed)
    }

    func test_parseBinaryImages_usesLastPathComponentAsName() {
        let addr: UInt64 = 0x1000
        let frame = makeFrame(objAddr: addr)
        let thread = makeThreadDict(crashed: true, frames: [frame])
        let img = makeImage(addr: addr, name: "/var/containers/Bundle/App.app/App")

        let sut = makeFormatter(threads: [thread], binaryImages: [img])
        let parsed = sut.parseBinaryImages(threads: [sut.parseThread(thread)])

        XCTAssertEqual(parsed?.first?.name, "App")
    }

    func test_parseBinaryImages_setsFullPath() {
        let addr: UInt64 = 0x1000
        let fullPath = "/var/containers/Bundle/App.app/App"
        let frame = makeFrame(objAddr: addr)
        let thread = makeThreadDict(crashed: true, frames: [frame])
        let img = makeImage(addr: addr, name: fullPath)

        let sut = makeFormatter(threads: [thread], binaryImages: [img])
        let parsed = sut.parseBinaryImages(threads: [sut.parseThread(thread)])

        XCTAssertEqual(parsed?.first?.path, fullPath)
    }

    func test_getException_setsHandledFlag() {
        let sut = makeFormatter()
        let result = sut.getException(true)
        XCTAssertTrue(result.handled)
    }

    func test_getException_setsFalseHandledFlag() {
        let sut = makeFormatter()
        let result = sut.getException(false)
        XCTAssertFalse(result.handled)
    }

    func test_getException_putsCrashedThreadFramesInExceptionDetail() {
        let frame = makeFrame()
        let crashedThread = makeThreadDict(index: 0, crashed: true, frames: [frame])
        let sut = makeFormatter(threads: [crashedThread])
        let result = sut.getException()
        XCTAssertEqual(result.exceptions.first?.frames?.count, 1)
    }

    func test_getException_putsNonCrashedThreadsInThreads() {
        let crashedThread    = makeThreadDict(index: 0, crashed: true,  frames: [makeFrame()])
        let nonCrashedThread = makeThreadDict(index: 1, crashed: false, frames: [makeFrame(objAddr: 0x2000)])
        let sut = makeFormatter(
            threads: [crashedThread, nonCrashedThread],
            binaryImages: [
                makeImage(addr: 0x1000),
                makeImage(addr: 0x2000)
            ]
        )
        let result = sut.getException()
        XCTAssertEqual(result.threads?.count, 1)
        XCTAssertEqual(result.threads?.first?.sequence, 1)
    }

    func test_getException_returnsNilThreadsWhenNoCrashedThread() {
        let nonCrashedThread = makeThreadDict(index: 0, crashed: false)
        let sut = makeFormatter(threads: [nonCrashedThread])
        let result = sut.getException()
        XCTAssertNil(result.threads)
    }

    func test_getException_returnsNilBinaryImagesWhenNoCrashedThread() {
        let nonCrashedThread = makeThreadDict(index: 0, crashed: false)
        let sut = makeFormatter(threads: [nonCrashedThread])
        let result = sut.getException()
        XCTAssertNil(result.binaryImages)
    }

    func test_getException_setsForegroundFromSystemStats() {
        let crashedThread = makeThreadDict(index: 0, crashed: true, frames: [makeFrame()])
        let sut = makeFormatter(
            threads: [crashedThread],
            binaryImages: [makeImage(addr: 0x1000)],
            system: ["application_stats": ["application_in_foreground": true]]
        )
        XCTAssertEqual(sut.getException().foreground, true)
    }

    func test_getException_passesMsrErrorThrough() {
        let sut = makeFormatter()
        let msrError = MsrError(numcode: 100, code: "Error", meta: nil)
        let result = sut.getException(false, error: msrError)
        XCTAssertNotNil(result.error)
        XCTAssertEqual(result.error?.numcode, 100)
        XCTAssertEqual(result.error?.code, "Error")
    }

    func test_getException_setsFrameworkToApple() {
        let sut = makeFormatter()
        XCTAssertEqual(sut.getException().framework, Framework.apple)
    }
}
