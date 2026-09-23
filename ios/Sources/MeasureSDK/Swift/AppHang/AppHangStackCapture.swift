//
//  AppHangStackCapture.swift
//  Measure
//
//  Created by Adwin Ross on 21/09/26.
//

// `KSBacktrace.h` and `KSDynamicLinker.h` live in KSCrashRecordingCore under SPM, but CocoaPods
// flattens KSCrash into a single module. Mirrors the import pattern used by the crash reporter.
#if canImport(KSCrashRecordingCore)
import KSCrashRecordingCore
#elseif canImport(KSCrash)
import KSCrash
#endif
import Foundation

/// The blocked main thread, captured at the moment a hang was detected.
struct AppHangStack {
    let frames: [StackFrame]
    let binaryImages: [BinaryImage]
}

protocol AppHangStackCapture {
    /// Captures the main thread's stack. Returns `nil` if the thread could not be walked.
    ///
    /// Called while the main thread is still blocked. Capturing after it recovers would show
    /// whatever the app moved on to rather than the cause of the hang.
    func capture() -> AppHangStack?
}

/// Captures the main thread's stack without suspending it.
///
/// Addresses are recorded raw and symbolicated on the backend against an uploaded dSYM, which is
/// both cheaper here and the only thing that works on stripped release builds.
///
/// Reads the image list through KSCrash's lock-free `ksdl_dladdr` rather than libdyld's `dladdr`.
/// A hung main thread may be blocked inside dyld holding its lock, which would stall this thread
/// until the hang resolved — exactly when the capture is needed.
final class BaseAppHangStackCapture: AppHangStackCapture {
    private let logger: Logger

    /// Resolved at init rather than at hang time, so a hang during launch can still be captured.
    private var mainThreadId: thread_t = 0

    /// Allocated once. Allocating during a capture risks contending with the main thread over the
    /// allocator lock at the exact moment that thread is stuck.
    private var frameBuffer = [uintptr_t](repeating: 0, count: AppHangConstants.maxFrames)

    private let executableName = Bundle.main.object(forInfoDictionaryKey: "CFBundleExecutable") as? String

    init(logger: Logger) {
        self.logger = logger

        // Populates the binary image list that `ksdl_dladdr` resolves against. KSCrash calls this
        // on activation, but app hang detection must not depend on the crash reporter having been
        // enabled first — without it every address resolves to nothing and the frames arrive with
        // no images to symbolicate against. Idempotent.
        ksdl_init()

        resolveMainThreadId()
    }

    private func resolveMainThreadId() {
        if Thread.isMainThread {
            mainThreadId = pthread_mach_thread_np(pthread_self())
        } else {
            // Enqueued before the detector thread starts, so it resolves before any probe runs.
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

        // Only images actually referenced by a frame are reported, matching how
        // `CrashDataFormatter` narrows the image list for an exception.
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

    // MARK: - Mapping

    /// Mirrors `CrashDataFormatter.parseFrame`, including its field naming: the instruction address
    /// is reported as `symbolAddress` and the image load address as `binaryAddress`. The backend
    /// symbolicator reads app hang frames exactly as it reads exception frames, so the two must
    /// agree even where the names read oddly.
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
