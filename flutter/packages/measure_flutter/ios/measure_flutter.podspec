require 'yaml'
pubspec = YAML.load_file('./../pubspec.yaml')
version = pubspec['version'].to_s

Pod::Spec.new do |s|
  s.name             = 'measure_flutter'
  s.version          = version
  s.summary          = 'Open source tool to monitor mobile apps'
  s.homepage         = "https://github.com/measure-sh/measure.git"
  s.license          = { :type => "Apache 2.0", :file => "LICENSE" }
  s.author       = "measure.sh"
  s.source           = { :path => '.' }
  s.source_files = 'Classes/**/*'
  s.resources = ['Resources/PrivacyInfo.xcprivacy']
  s.dependency 'Flutter'
  s.dependency "measure-sh", "0.5.1"
  s.platform = :ios, '12.0'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386' }
  s.swift_version = '5.10'
end
