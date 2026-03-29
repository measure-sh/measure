# DEPRECATED: CocoaPods support for measure-sh is deprecated and will be removed in June 2026.
# Please migrate to Swift Package Manager (SPM). Add the following to your Package.swift:
#   .package(url: "https://github.com/measure-sh/measure.git", from: "<version>")
# Or in Xcode: File > Add Package Dependencies... and enter the repository URL above.

Pod::Spec.new do |spec|
  spec.name         = "measure-sh"
  spec.module_name  = "Measure"
  spec.version      = "0.9.2"
  spec.deprecated   = true
  spec.deprecated_in_favor_of = "Use Swift Package Manager instead"
  spec.summary      = "[DEPRECATED] Open source tool to monitor mobile apps — migrate to SPM"
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
end
