// swift-tools-version: 5.7
import PackageDescription

let package = Package(
    name: "Measure",
    platforms: [
        .iOS(.v12)
    ],
    products: [
        .library(
            name: "Measure",
            targets: ["Measure"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/microsoft/plcrashreporter.git", from: "1.11.2")
    ],
    targets: [
        // ObjC target
        .target(
            name: "MeasureObjC",
            path: "ios/Sources/MeasureSDK/ObjC",
            publicHeadersPath: "include"
        ),

        // Swift target, depends on ObjC + CrashReporter
        .target(
            name: "Measure",
            dependencies: [
                "MeasureObjC",
                .product(name: "CrashReporter", package: "plcrashreporter")
            ],
            path: "ios/Sources/MeasureSDK/Swift",
            resources: [
                .process("XCDataModel/MeasureModel.xcdatamodeld"),
                .copy("Resources/PrivacyInfo.xcprivacy")
            ]
        ),

        // Tests
        .testTarget(
            name: "MeasureSDKTests",
            dependencies: ["Measure"],
            path: "ios/Tests/MeasureSDKTests"
        ),
        .testTarget(
            name: "MeasureUITests",
            dependencies: ["Measure"],
            path: "ios/Tests/MeasureUITests"
        ),
    ]
)
