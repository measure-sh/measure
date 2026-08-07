//
//  ExpoAttributeTests.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 29/07/26.
//

import XCTest
@testable import Measure

final class ExpoAttributeTests: XCTestCase {
    private let expoDict: [String: Any?] = [
        "expo_update_id": "0f8fad5b-d9cb-469f-a165-70867728950e",
        "expo_runtime_version": "2.0.0",
        "is_expo_embedded_launch": false,
        "is_expo_using_embedded_assets": true,
        "expo_automatic_update_policy": "on_load",
        "expo_execution_environment": "standalone",
        "expo_version": "56.0.9",
        "expo_sdk_version": "56.0.0",
        "expo_eas_project_id": "eas-project-id"
    ]

    func testReadsExpoAttributesFromDictionary() {
        let attributes = Attributes(dict: expoDict)

        XCTAssertEqual(attributes.expoUpdateId, "0f8fad5b-d9cb-469f-a165-70867728950e")
        XCTAssertEqual(attributes.expoRuntimeVersion, "2.0.0")
        XCTAssertEqual(attributes.isExpoEmbeddedLaunch, false)
        XCTAssertEqual(attributes.isExpoUsingEmbeddedAssets, true)
        XCTAssertEqual(attributes.expoAutomaticUpdatePolicy, "on_load")
        XCTAssertEqual(attributes.expoExecutionEnvironment, "standalone")
        XCTAssertEqual(attributes.expoVersion, "56.0.9")
        XCTAssertEqual(attributes.expoSdkVersion, "56.0.0")
        XCTAssertEqual(attributes.expoEasProjectId, "eas-project-id")
    }

    func testExpoAttributesAreNilWhenAbsentFromDictionary() {
        let attributes = Attributes(dict: ["device_name": "iPhone 14"])

        XCTAssertNil(attributes.expoUpdateId)
        XCTAssertNil(attributes.expoRuntimeVersion)
        XCTAssertNil(attributes.isExpoEmbeddedLaunch)
        XCTAssertNil(attributes.isExpoUsingEmbeddedAssets)
        XCTAssertNil(attributes.expoAutomaticUpdatePolicy)
        XCTAssertNil(attributes.expoExecutionEnvironment)
        XCTAssertNil(attributes.expoVersion)
        XCTAssertNil(attributes.expoSdkVersion)
        XCTAssertNil(attributes.expoEasProjectId)
    }

    func testEncodesExpoAttributesWithSnakeCaseKeys() throws {
        let attributes = Attributes(dict: expoDict)

        let data = try JSONEncoder().encode(attributes)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertEqual(json["expo_update_id"] as? String, "0f8fad5b-d9cb-469f-a165-70867728950e")
        XCTAssertEqual(json["expo_runtime_version"] as? String, "2.0.0")
        XCTAssertEqual(json["is_expo_embedded_launch"] as? Bool, false)
        XCTAssertEqual(json["is_expo_using_embedded_assets"] as? Bool, true)
        XCTAssertEqual(json["expo_automatic_update_policy"] as? String, "on_load")
        XCTAssertEqual(json["expo_execution_environment"] as? String, "standalone")
        XCTAssertEqual(json["expo_version"] as? String, "56.0.9")
        XCTAssertEqual(json["expo_sdk_version"] as? String, "56.0.0")
        XCTAssertEqual(json["expo_eas_project_id"] as? String, "eas-project-id")
    }

    func testOmitsExpoAttributesFromPayloadWhenNil() throws {
        let attributes = Attributes(dict: ["device_name": "iPhone 14"])

        let data = try JSONEncoder().encode(attributes)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertNil(json["expo_update_id"])
        XCTAssertNil(json["expo_runtime_version"])
        XCTAssertNil(json["is_expo_embedded_launch"])
        XCTAssertNil(json["is_expo_using_embedded_assets"])
        XCTAssertNil(json["expo_automatic_update_policy"])
        XCTAssertNil(json["expo_execution_environment"])
        XCTAssertNil(json["expo_version"])
        XCTAssertNil(json["expo_sdk_version"])
        XCTAssertNil(json["expo_eas_project_id"])
    }

    func testDecodesExpoAttributesFromEncodedPayload() throws {
        let data = try JSONEncoder().encode(Attributes(dict: expoDict))

        let decoded = try JSONDecoder().decode(Attributes.self, from: data)

        XCTAssertEqual(decoded.expoUpdateId, "0f8fad5b-d9cb-469f-a165-70867728950e")
        XCTAssertEqual(decoded.isExpoEmbeddedLaunch, false)
        XCTAssertEqual(decoded.expoAutomaticUpdatePolicy, "on_load")
        XCTAssertEqual(decoded.expoEasProjectId, "eas-project-id")
    }

    func testReadsBooleansBridgedFromReactNativeAsNSNumber() {
        let bridged: NSDictionary = [
            "expo_update_id": "0f8fad5b-d9cb-469f-a165-70867728950e",
            "is_expo_embedded_launch": false,
            "is_expo_using_embedded_assets": true
        ]

        let attributes = Attributes(dict: bridged as? [String: Any?] ?? [:])

        XCTAssertEqual(attributes.expoUpdateId, "0f8fad5b-d9cb-469f-a165-70867728950e")
        XCTAssertEqual(attributes.isExpoEmbeddedLaunch, false)
        XCTAssertEqual(attributes.isExpoUsingEmbeddedAssets, true)
    }

    func testExpoUpdateIdIsIndependentOfPatchId() {
        var dict = expoDict
        dict["patch_id"] = "patch-id"

        let attributes = Attributes(dict: dict)

        XCTAssertEqual(attributes.patchId, "patch-id")
        XCTAssertEqual(attributes.expoUpdateId, "0f8fad5b-d9cb-469f-a165-70867728950e")
    }
}
