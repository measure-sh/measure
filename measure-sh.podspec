Pod::Spec.new do |spec|
  spec.name         = "measure-sh"
  spec.module_name  = "Measure"
  spec.version      = "0.0.1"
  spec.summary      = "Open source tool to monitor mobile apps"
  spec.homepage     = "https://github.com/measure-sh/measure.git"
  spec.license      = { :type => "MIT", :file => "LICENSE" }
  spec.author       = "measure.sh"
  spec.platform     = :ios, "12.0"
  spec.swift_version = "5.10"
  spec.static_framework = true
  spec.source       = { :git => "https://github.com/measure-sh/measure.git",
                        :tag => "ios-v#{spec.version}" }
  spec.source_files = "ios/Sources/MeasureSDK/Swift/**/*.{swift}", "ios/Sources/MeasureSDK/Objc/**/*.{h,m}"
  spec.public_header_files = "ios/Sources/MeasureSDK/Objc/include/**/*.h"
  spec.resources    = ["ios/Sources/MeasureSDK/Swift/XCDataModel/MeasureModel.xcdatamodeld", "ios/Sources/MeasureSDK/Swift/Resources/PrivacyInfo.xcprivacy"]
  spec.frameworks   = "Foundation", "UIKit", "CoreData"
  spec.dependency "PLCrashReporter"
end
