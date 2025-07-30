Pod::Spec.new do |spec|
  spec.name         = "measure-sh"
  spec.module_name  = "Measure"
  spec.version      = "0.5.1"
  spec.summary      = "Open source tool to monitor mobile apps"
  spec.homepage     = "https://github.com/measure-sh/measure.git"
  spec.license      = { :type => "Apache 2.0", :file => "LICENSE" }
  spec.author       = "measure.sh"
  spec.platform     = :ios, "12.0"
  spec.swift_version = "5.10"
  spec.static_framework = true
  spec.source       = { :git => "https://github.com/measure-sh/measure.git",
                        :tag => "ios-v#{spec.version}" }
  spec.source_files = "ios/Sources/MeasureSDK/Swift/**/*.{swift}", "ios/Sources/MeasureSDK/Objc/**/*.{h,m}"
  spec.public_header_files = "ios/Sources/MeasureSDK/Objc/include/**/*.h"
  spec.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "SWIFT_OBJC_INTERFACE_HEADER_NAME" => "Measure.h"
  }
  spec.resources    = ["ios/Sources/MeasureSDK/Swift/XCDataModel/MeasureModel.xcdatamodeld"]
  spec.frameworks   = "Foundation", "UIKit", "CoreData"
  spec.dependency "PLCrashReporter"
end
