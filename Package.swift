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
        .package(url: "https://github.com/kstenerud/KSCrash.git", from: "2.5.1")
    ],
    targets: [
        .target(
            name: "MeasureWebP",
            path: "ios/Sources/MeasureWebP",
            sources: [
                "libwebp/src/enc",
                "libwebp/sharpyuv",
                "libwebp/src/utils",
                "libwebp/src/dsp/cpu.c",
                "libwebp/src/dsp/alpha_processing.c",
                "libwebp/src/dsp/alpha_processing_mips_dsp_r2.c",
                "libwebp/src/dsp/alpha_processing_neon.c",
                "libwebp/src/dsp/alpha_processing_sse2.c",
                "libwebp/src/dsp/alpha_processing_sse41.c",
                "libwebp/src/dsp/cost.c",
                "libwebp/src/dsp/cost_mips32.c",
                "libwebp/src/dsp/cost_mips_dsp_r2.c",
                "libwebp/src/dsp/cost_neon.c",
                "libwebp/src/dsp/cost_sse2.c",
                "libwebp/src/dsp/enc.c",
                "libwebp/src/dsp/enc_mips32.c",
                "libwebp/src/dsp/enc_mips_dsp_r2.c",
                "libwebp/src/dsp/enc_msa.c",
                "libwebp/src/dsp/enc_neon.c",
                "libwebp/src/dsp/enc_sse2.c",
                "libwebp/src/dsp/enc_sse41.c",
                "libwebp/src/dsp/filters.c",
                "libwebp/src/dsp/filters_mips_dsp_r2.c",
                "libwebp/src/dsp/filters_msa.c",
                "libwebp/src/dsp/filters_neon.c",
                "libwebp/src/dsp/filters_sse2.c",
                "libwebp/src/dsp/lossless_enc.c",
                "libwebp/src/dsp/lossless_enc_avx2.c",
                "libwebp/src/dsp/lossless_enc_mips32.c",
                "libwebp/src/dsp/lossless_enc_mips_dsp_r2.c",
                "libwebp/src/dsp/lossless_enc_msa.c",
                "libwebp/src/dsp/lossless_enc_neon.c",
                "libwebp/src/dsp/lossless_enc_sse2.c",
                "libwebp/src/dsp/lossless_enc_sse41.c",
                "libwebp/src/dsp/rescaler.c",
                "libwebp/src/dsp/rescaler_mips32.c",
                "libwebp/src/dsp/rescaler_mips_dsp_r2.c",
                "libwebp/src/dsp/rescaler_msa.c",
                "libwebp/src/dsp/rescaler_neon.c",
                "libwebp/src/dsp/rescaler_sse2.c",
                "libwebp/src/dsp/ssim.c",
                "libwebp/src/dsp/ssim_sse2.c",
                "libwebp/src/dsp/dec.c",
                "libwebp/src/dsp/dec_clip_tables.c",
                "libwebp/src/dsp/dec_mips32.c",
                "libwebp/src/dsp/dec_mips_dsp_r2.c",
                "libwebp/src/dsp/dec_msa.c",
                "libwebp/src/dsp/dec_neon.c",
                "libwebp/src/dsp/dec_sse2.c",
                "libwebp/src/dsp/dec_sse41.c",
                "libwebp/src/dsp/lossless.c",
                "libwebp/src/dsp/lossless_avx2.c",
                "libwebp/src/dsp/lossless_mips_dsp_r2.c",
                "libwebp/src/dsp/lossless_msa.c",
                "libwebp/src/dsp/lossless_neon.c",
                "libwebp/src/dsp/lossless_sse2.c",
                "libwebp/src/dsp/lossless_sse41.c",
                "libwebp/src/dsp/yuv.c",
                "libwebp/src/dsp/yuv_mips32.c",
                "libwebp/src/dsp/yuv_mips_dsp_r2.c",
                "libwebp/src/dsp/yuv_neon.c",
                "libwebp/src/dsp/yuv_sse2.c",
                "libwebp/src/dsp/yuv_sse41.c",
                "libwebp/src/dsp/upsampling.c",
                "libwebp/src/dsp/upsampling_mips_dsp_r2.c",
                "libwebp/src/dsp/upsampling_msa.c",
                "libwebp/src/dsp/upsampling_neon.c",
                "libwebp/src/dsp/upsampling_sse2.c",
                "libwebp/src/dsp/upsampling_sse41.c",
            ],
            publicHeadersPath: "include",
            cSettings: [
                .headerSearchPath("libwebp"),
                .headerSearchPath("libwebp/src"),
            ]
        ),
        .target(
            name: "Measure",
            dependencies: [
                .product(name: "Recording", package: "KSCrash"),
                "MeasureWebP",
            ],
            path: "ios/Sources/MeasureSDK/Swift",
            resources: [
                .process("XCDataModel/MeasureModel.xcdatamodeld"),
                .process("XCDataModel/MeasureModelV1ToV2.xcmappingmodel"),
                .copy("Resources/PrivacyInfo.xcprivacy")
            ]
        ),
        .target(
            name: "MeasureObjC",
            dependencies: [
                "Measure"
            ],
            path: "ios/Sources/MeasureSDK/ObjC",
            publicHeadersPath: "include"
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
