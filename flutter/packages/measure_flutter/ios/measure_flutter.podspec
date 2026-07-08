#
# To learn more about a Podspec see http://guides.cocoapods.org/syntax/podspec.html.
# Run `pod lib lint measure_flutter.podspec` to validate before publishing.
#
Pod::Spec.new do |s|
  s.name             = 'measure_flutter'
  s.version          = '0.7.0'
  s.summary          = 'Measure Flutter iOS Plugin'
  s.description      = <<-DESC
Measure Flutter iOS Plugin.
                       DESC
  s.homepage         = 'https://measure.sh'
  s.author           = { 'Measure.sh' => 'email@example.com' }
  s.source           = { :path => '.' }
  s.source_files = 'measure_flutter/Sources/measure_flutter/**/*.swift'
  s.resource_bundles = { 'measure_flutter_privacy' => ['measure_flutter/Sources/measure_flutter/PrivacyInfo.xcprivacy'] }
  s.dependency 'Flutter'
  s.dependency 'measure-sh', '~> 0.12.0'
  s.platform = :ios, '12.0'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386' }
  s.swift_version = '5.10'
end
