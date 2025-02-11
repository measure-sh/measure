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
            name: "MeasureSDKObjc",
            dependencies: [],
            path: "Sources/MeasureSDK/Objc",
            publicHeadersPath: "include"
        ),
        .target(
            name: "MeasureSDK",
            dependencies: [
                "MeasureSDKObjc",
                .product(name: "CrashReporter", package: "plcrashreporter")
            ],
            path: "Sources/MeasureSDK/Swift"
        ),
        .testTarget(
            name: "MeasureSDKTests",
            dependencies: ["MeasureSDK"],
            path: "Tests/MeasureSDKTests"
        ),
        .testTarget(
            name: "MeasureUITests",
            dependencies: ["MeasureSDK"],
            path: "Tests/MeasureUITests"
        ),
    ]
)
