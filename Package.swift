// swift-tools-version: 5.7
import PackageDescription

let package = Package(
    name: "MeasureSDK",
    platforms: [
        .iOS(.v12)
    ],
    products: [
        .library(
            name: "MeasureSDK",
            targets: ["MeasureSDK"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/microsoft/plcrashreporter.git", from: "1.11.2")
    ],
    targets: [
        .target(
            name: "MeasureSDK",
            dependencies: [
                .product(name: "CrashReporter", package: "plcrashreporter")
            ],
            path: "ios/Sources/MeasureSDK/Swift",
            resources: [
                .process("XCDataModel/MeasureModel.xcdatamodeld"),
                .copy("Resources/PrivacyInfo.xcprivacy")
            ]
        ),
        .testTarget(
            name: "MeasureSDKTests",
            dependencies: ["MeasureSDK"],
            path: "ios/Tests/MeasureSDKTests"
        ),
        .testTarget(
            name: "MeasureUITests",
            dependencies: ["MeasureSDK"],
            path: "ios/Tests/MeasureUITests"
        ),
    ]
)
