//
//  BuildEnvironmentTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 10/11/26.
//

import XCTest
@testable import Measure

final class BuildEnvironmentTests: XCTestCase {
    private var sysCtl: MockSysCtl!
    private var profilePath: String!

    override func setUp() {
        super.setUp()
        sysCtl = MockSysCtl()
        profilePath = NSTemporaryDirectory().appending("embedded-\(UUID().uuidString).mobileprovision")
    }

    override func tearDown() {
        try? FileManager.default.removeItem(atPath: profilePath)
        sysCtl = nil
        profilePath = nil
        super.tearDown()
    }

    func testTreatsAppAsDebugBuildWhenRunningOnSimulator() {
        let sut = BaseBuildEnvironment(sysCtl: sysCtl, isSimulator: true, provisioningProfilePath: nil)

        XCTAssertTrue(sut.isDebugBuild)
    }

    func testTreatsAppAsDebugBuildWhenDebuggerIsAttached() {
        sysCtl.debuggerAttached = true

        let sut = BaseBuildEnvironment(sysCtl: sysCtl, isSimulator: false, provisioningProfilePath: nil)

        XCTAssertTrue(sut.isDebugBuild)
    }

    func testTreatsAppAsDebugBuildWhenProfileAllowsDebugging() {
        writeProfile(getTaskAllow: true)

        let sut = BaseBuildEnvironment(sysCtl: sysCtl, isSimulator: false, provisioningProfilePath: profilePath)

        XCTAssertTrue(sut.isDebugBuild)
    }

    func testTreatsAppAsReleaseBuildWhenProfileDoesNotAllowDebugging() {
        writeProfile(getTaskAllow: false)

        let sut = BaseBuildEnvironment(sysCtl: sysCtl, isSimulator: false, provisioningProfilePath: profilePath)

        XCTAssertFalse(sut.isDebugBuild)
    }

    func testTreatsAppAsReleaseBuildWhenProfileFileIsMissing() {
        let sut = BaseBuildEnvironment(sysCtl: sysCtl, isSimulator: false, provisioningProfilePath: profilePath)

        XCTAssertFalse(sut.isDebugBuild)
    }

    func testTreatsAppAsReleaseBuildWhenAppHasNoProfile() {
        let sut = BaseBuildEnvironment(sysCtl: sysCtl, isSimulator: false, provisioningProfilePath: nil)

        XCTAssertFalse(sut.isDebugBuild)
    }

    func testTreatsAppAsReleaseBuildWhenProfileHasNoPlist() {
        FileManager.default.createFile(atPath: profilePath, contents: Data("not a profile".utf8))

        let sut = BaseBuildEnvironment(sysCtl: sysCtl, isSimulator: false, provisioningProfilePath: profilePath)

        XCTAssertFalse(sut.isDebugBuild)
    }

    func testTreatsAppAsReleaseBuildForRandomBytes() {
        var generator = SeededGenerator(seed: 4815)

        for _ in 0..<2000 {
            let length = Int.random(in: 0...4096, using: &generator)
            let bytes = (0..<length).map { _ in UInt8.random(in: 0...255, using: &generator) }
            FileManager.default.createFile(atPath: profilePath, contents: Data(bytes))

            XCTAssertFalse(BaseBuildEnvironment.allowsDebugging(provisioningProfilePath: profilePath))
        }
    }

    func testDoesNotCrashForCorruptedProfiles() {
        var generator = SeededGenerator(seed: 4816)
        let valid = profileData(getTaskAllow: true)

        for _ in 0..<2000 {
            var bytes = [UInt8](valid)
            switch Int.random(in: 0...3, using: &generator) {
            case 0:
                bytes = Array(bytes.prefix(Int.random(in: 0...bytes.count, using: &generator)))
            case 1:
                for _ in 0..<Int.random(in: 1...20, using: &generator) {
                    bytes[Int.random(in: 0..<bytes.count, using: &generator)] = UInt8.random(in: 0...255, using: &generator)
                }
            case 2:
                let junk = (0..<Int.random(in: 1...200, using: &generator)).map { _ in UInt8.random(in: 0...255, using: &generator) }
                bytes.insert(contentsOf: junk, at: Int.random(in: 0...bytes.count, using: &generator))
            default:
                bytes = [UInt8]("</plist>".utf8) + bytes + [UInt8]("<?xml".utf8) + bytes
            }
            FileManager.default.createFile(atPath: profilePath, contents: Data(bytes))

            _ = BaseBuildEnvironment.allowsDebugging(provisioningProfilePath: profilePath)
        }
    }

    func testTreatsAppAsReleaseBuildWhenProfileIsTruncated() {
        let valid = profileData(getTaskAllow: true)
        let end = valid.range(of: Data("</plist>".utf8))!.upperBound

        for length in 0..<end {
            FileManager.default.createFile(atPath: profilePath, contents: valid.prefix(length))

            XCTAssertFalse(BaseBuildEnvironment.allowsDebugging(provisioningProfilePath: profilePath))
        }
    }

    func testTreatsAppAsReleaseBuildWhenGetTaskAllowIsNotBool() {
        for value in ["<string>true</string>", "<dict/>", "<array/>"] {
            writeProfile(getTaskAllowValue: value)

            XCTAssertFalse(BaseBuildEnvironment.allowsDebugging(provisioningProfilePath: profilePath))
        }
    }

    func testTreatsAppAsReleaseBuildWhenEntitlementsIsNotDictionary() {
        writeProfile(plistBody: "<key>Entitlements</key><string>get-task-allow</string>")

        XCTAssertFalse(BaseBuildEnvironment.allowsDebugging(provisioningProfilePath: profilePath))
    }

    func testTreatsAppAsReleaseBuildWhenPlistEndComesBeforeStart() {
        let valid = profileData(getTaskAllow: true)
        let start = valid.range(of: Data("<?xml".utf8))!.lowerBound
        var data = Data("</plist>".utf8)
        data.append(valid.prefix(upTo: start))
        data.append(Data("<?xml version=\"1.0\"?>".utf8))
        FileManager.default.createFile(atPath: profilePath, contents: data)

        XCTAssertFalse(BaseBuildEnvironment.allowsDebugging(provisioningProfilePath: profilePath))
    }

    func testTreatsAppAsDebugBuildWhenProfileIsLarge() {
        var data = Data(repeating: 0xAB, count: 10 * 1024 * 1024)
        data.append(profileData(getTaskAllow: true))
        FileManager.default.createFile(atPath: profilePath, contents: data)

        XCTAssertTrue(BaseBuildEnvironment.allowsDebugging(provisioningProfilePath: profilePath))
    }

    private func writeProfile(getTaskAllowValue: String) {
        writeProfile(plistBody: "<key>Entitlements</key><dict><key>get-task-allow</key>\(getTaskAllowValue)</dict>")
    }

    private func writeProfile(plistBody: String) {
        let plist = """
        <?xml version="1.0" encoding="UTF-8"?>
        <plist version="1.0"><dict>\(plistBody)</dict></plist>
        """
        FileManager.default.createFile(atPath: profilePath, contents: Data(plist.utf8))
    }

    private func profileData(getTaskAllow: Bool) -> Data {
        writeProfile(getTaskAllow: getTaskAllow)
        return FileManager.default.contents(atPath: profilePath)!
    }

    /// Writes a profile shaped like a real one: the plist surrounded by binary CMS signature bytes.
    private func writeProfile(getTaskAllow: Bool) {
        let plist = """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
            <key>Entitlements</key>
            <dict>
                <key>get-task-allow</key>
                <\(getTaskAllow ? "true" : "false")/>
            </dict>
        </dict>
        </plist>
        """
        var data = Data([0x30, 0x82, 0x0A, 0x00, 0xFF])
        data.append(Data(plist.utf8))
        data.append(Data([0x00, 0xA0, 0x82, 0xFF]))
        FileManager.default.createFile(atPath: profilePath, contents: data)
    }
}

/// SplitMix64, so fuzz inputs are the same on every run.
private struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var value = state
        value = (value ^ (value >> 30)) &* 0xBF58476D1CE4E5B9
        value = (value ^ (value >> 27)) &* 0x94D049BB133111EB
        return value ^ (value >> 31)
    }
}
