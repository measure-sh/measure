Pod::Spec.new do |spec|
  spec.name         = "measure-sh"
  spec.module_name  = "Measure"
  spec.version      = "0.10.0"
  spec.summary      = "Open source tool to monitor mobile apps"
  spec.homepage     = "https://github.com/measure-sh/measure.git"
  spec.license      = { :type => "Apache 2.0", :file => "LICENSE" }
  spec.author       = "measure.sh"
  spec.platform     = :ios, "12.0"
  spec.swift_version = "5.10"
  spec.static_framework = true
  spec.source       = { :git => "https://github.com/measure-sh/measure.git",
                        :tag => "ios-v#{spec.version}" }
  spec.source_files = "ios/Sources/MeasureSDK/Swift/**/*.{swift}", "ios/Sources/MeasureSDK/ObjC/**/*.{h,m}"
  spec.public_header_files = "ios/Sources/MeasureSDK/ObjC/include/**/*.h"
  spec.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES"
  }
  spec.resources    = [
    "ios/Sources/MeasureSDK/Swift/XCDataModel/MeasureModel.xcdatamodeld",
    "ios/Sources/MeasureSDK/Swift/XCDataModel/MeasureModelV1ToV2.xcmappingmodel"
  ]
  spec.frameworks   = "Foundation", "UIKit", "CoreData"
  spec.dependency "KSCrash", "~> 2.5"

  spec.subspec 'WebP' do |ss|
    ss.source_files = [
      "ios/Sources/MeasureWebP/libwebp/sharpyuv/*.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/enc/**/*.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/dsp/cpu.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/dsp/alpha_processing*.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/dsp/cost*.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/dsp/enc*.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/dsp/filters*.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/dsp/dec*.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/dsp/lossless*.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/dsp/rescaler*.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/dsp/ssim*.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/dsp/upsampling*.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/dsp/yuv*.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/utils/*.{c,h}",
      "ios/Sources/MeasureWebP/libwebp/src/webp/encode.h",
      "ios/Sources/MeasureWebP/libwebp/src/webp/types.h",
      "ios/Sources/MeasureWebP/include/MeasureWebP.h",
    ]
    ss.public_header_files = "ios/Sources/MeasureWebP/include/MeasureWebP.h"
    ss.pod_target_xcconfig = {
      "HEADER_SEARCH_PATHS" => "\"$(PODS_TARGET_SRCROOT)/ios/Sources/MeasureWebP/libwebp\" \"$(PODS_TARGET_SRCROOT)/ios/Sources/MeasureWebP/libwebp/src\""
    }
  end

  spec.default_subspecs = ['WebP']
end
