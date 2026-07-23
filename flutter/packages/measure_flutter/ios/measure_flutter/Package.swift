// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "measure_flutter",
    platforms: [
        .iOS("12.0")
    ],
    products: [
        .library(name: "measure-flutter", targets: ["measure_flutter"])
    ],
    dependencies: [
        .package(name: "FlutterFramework", path: "../FlutterFramework"),
        // The native Measure iOS SDK is consumed over SPM by pinning to its release
        // tag via `branch:`, matching the iOS SDK integration guide. The tag name is
        // stamped in automatically during the Flutter release workflow.
        //
        // MeasureSDK must be linked statically; dynamic linking is not supported. SPM
        // links `measure-sh` statically by default (automatic library linkage).
        .package(url: "https://github.com/measure-sh/measure.git", branch: "ios-v0.12.0")
    ],
    targets: [
        .target(
            name: "measure_flutter",
            dependencies: [
                .product(name: "FlutterFramework", package: "FlutterFramework"),
                .product(name: "Measure", package: "measure")
            ],
            resources: [
                .process("PrivacyInfo.xcprivacy")
            ]
        )
    ]
)
