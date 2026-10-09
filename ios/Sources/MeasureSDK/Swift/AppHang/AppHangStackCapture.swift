//
//  AppHangStackCapture.swift
//  Measure
//
//  Created by Adwin Ross on 21/09/26.
//

#if canImport(KSCrashRecordingCore)
import KSCrashRecordingCore
#elseif canImport(KSCrash)
import KSCrash
#endif
import Foundation

struct AppHangStack {
    let frames: [StackFrame]
    let binaryImages: [BinaryImage]
}

protocol AppHangStackCapture {
    func capture() -> AppHangStack?
}

final class BaseAppHangStackCapture: AppHangStackCapture {
    private let logger: Logger
    private var mainThreadId: thread_t = 0
    private var frameBuffer = [uintptr_t](repeating: 0, count: AppHangConstants.maxFrames)
    private let executableName = Bundle.main.object(forInfoDictionaryKey: "CFBundleExecutable") as? String

    init(logger: Logger) {
        self.logger = logger
        ksdl_init()
        resolveMainThreadId()
    }

    private func resolveMainThreadId() {
        if Thread.isMainThread {
            mainThreadId = pthread_mach_thread_np(pthread_self())
        } else {
            DispatchQueue.main.async { [weak self] in
                self?.mainThreadId = pthread_mach_thread_np(pthread_self())
            }
        }
    }

    func capture() -> AppHangStack? {
        guard mainThreadId != 0 else {
            logger.internalLog(level: .error, message: "AppHang: no main thread id, cannot capture stack trace.", error: nil, data: nil)
            return nil
        }

        let frameCount = frameBuffer.withUnsafeMutableBufferPointer { buffer -> Int in
            guard let base = buffer.baseAddress else { return 0 }
            return Int(captureBacktrace(machThread: mainThreadId, addresses: base, count: Int32(buffer.count)))
        }

        guard frameCount > 0 else {
            logger.internalLog(level: .error, message: "AppHang: stack trace capture returned no frames.", error: nil, data: nil)
            return nil
        }

        var frames: [StackFrame] = []
        frames.reserveCapacity(frameCount)

        var imageHeaders: [UInt64: UnsafeRawPointer] = [:]
        var imageNames: [UInt64: String] = [:]

        for index in 0..<frameCount {
            let address = frameBuffer[index]
            var info = Dl_info()

            guard ksdl_dladdr(address, &info) else {
                frames.append(makeFrame(index: index, address: address, info: nil))
                continue
            }

            frames.append(makeFrame(index: index, address: address, info: info))

            if let base = info.dli_fbase {
                let baseAddress = UInt64(UInt(bitPattern: base))
                if imageHeaders[baseAddress] == nil {
                    imageHeaders[baseAddress] = UnsafeRawPointer(base)
                    imageNames[baseAddress] = info.dli_fname.map { String(cString: $0) } ?? ""
                }
            }
        }

        let binaryImages = imageHeaders.compactMap { baseAddress, header -> BinaryImage? in
            makeBinaryImage(header: header, path: imageNames[baseAddress] ?? "")
        }

        return AppHangStack(frames: frames, binaryImages: binaryImages)
    }

    private func makeFrame(index: Int, address: uintptr_t, info: Dl_info?) -> StackFrame {
        let binaryPath = info?.dli_fname.map { String(cString: $0) }
        let binaryName = binaryPath.map { ($0 as NSString).lastPathComponent }
        let imageBase = info?.dli_fbase.map { UInt64(UInt(bitPattern: $0)) }
        let symbolAddress = info?.dli_saddr.map { UInt64(UInt(bitPattern: $0)) }

        let offset: Int?
        if let symbolAddress, UInt64(address) >= symbolAddress {
            offset = Int(UInt64(address) - symbolAddress)
        } else {
            offset = nil
        }

        return StackFrame(binaryName: binaryName,
                          binaryAddress: imageBase.map { hexString($0) },
                          offset: offset,
                          frameIndex: Number(index),
                          symbolAddress: hexString(UInt64(address)),
                          inApp: isAppBinary(name: binaryName),
                          className: nil,
                          methodName: nil,
                          fileName: nil,
                          lineNumber: nil,
                          columnNumber: nil,
                          moduleName: nil,
                          instructionAddress: nil)
    }

    private func makeBinaryImage(header: UnsafeRawPointer, path: String) -> BinaryImage? {
        var image = KSBinaryImage()
        guard path.withCString({ ksdl_binaryImageForHeader(header, $0, &image) }) else {
            return nil
        }

        let shortName = (path as NSString).lastPathComponent
        let size = max(1, image.size)

        return BinaryImage(startAddress: hexString(image.address),
                           endAddress: hexString(image.address + size),
                           baseAddress: nil,
                           system: !isAppBinary(name: shortName),
                           name: shortName,
                           arch: MachOArch.resolve(cpuType: image.cpuType, cpuSubType: image.cpuSubType),
                           uuid: uuidString(image.uuid),
                           path: path)
    }

    private func uuidString(_ bytes: UnsafePointer<UInt8>?) -> String {
        guard let bytes else { return "uuid" }
        return (0..<16).map { String(format: "%02x", bytes[$0]) }.joined()
    }

    private func isAppBinary(name: String?) -> Bool {
        guard let name else { return false }
        let short = (name as NSString).lastPathComponent
        let executable = executableName ?? ""
        return short == executable
            || short.hasSuffix(".debug.dylib")
            || (!executable.isEmpty && short.contains(executable))
    }

    private func hexString(_ value: UInt64) -> String {
        String(format: "%016llx", value)
    }
}
