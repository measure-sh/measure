require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
measure_ios_sdk = package['measureIosSdk'] || {}

Pod::Spec.new do |s|
    s.name             = "MeasureReactNative"
    s.version          = package['version']
    s.summary          = "A native bridge for the Measure React Native SDK"
    s.description      = "This pod provides a native bridge for integrating the Measure React Native SDK into iOS applications, allowing developers to utilize Measure's features seamlessly."
    s.homepage         = "https://github.com/measure-sh/measure.git"
    s.license          = { :type => "Apache 2.0", :file => "LICENSE" }
    s.author           = "measure.sh"
    s.source           = { :path => "." }
    s.platform     = :ios, "12.0"
    s.swift_version = "5.0"
    s.static_framework = true
    s.source_files = "ios/Swift/**/*.swift", "ios/ObjC/**/*.{h,m}"
    s.dependency "React-Core"

    measure_sdk_version  = measure_ios_sdk['version']
    measure_spm_url      = measure_ios_sdk['spmUrl']
    measure_spm_revision = measure_ios_sdk['revision']
    measure_spm_disabled = defined?($MeasureDisableSPM) && $MeasureDisableSPM == true

    if defined?(spm_dependency) && !measure_spm_disabled
      spm_dependency(s,
        url: measure_spm_url,
        requirement: { kind: 'revision', revision: measure_spm_revision },
        products: ['Measure']
      )
    else
      s.dependency 'measure-sh', measure_sdk_version
    end
  end