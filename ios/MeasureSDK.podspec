Pod::Spec.new do |spec|
    spec.name         = "MeasureSDK"
    spec.version      = "1.0.0"
    spec.summary      = "spec.summary"
    spec.description  = "spec.description"
    spec.homepage     = "https://github.com/measure-sh/measure"
    spec.license      = { :type => "MIT", :file => "LICENSE" }
    spec.author       = { "Adwin Ross" => "adwin@measure.sh" }
    spec.platform     = :ios, "12.0"
    spec.source       = { :path => "." }
    spec.source_files = "Sources/MeasureSDK/**/*.{h,m,swift}"
    spec.resources    = ["Sources/MeasureSDK/**/*.xcdatamodeld"]
    spec.frameworks   = "Foundation", "UIKit", "CoreData"
    spec.swift_version = "5.0"
    spec.static_framework = true
    spec.dependency "PLCrashReporter"
  end
  