Pod::Spec.new do |s|
    s.name             = "MeasureReactNative"
    s.version          = "0.1.0"
    s.summary          = "A native bridge for the Measure React Native SDK"
    s.description      = "This pod provides a native bridge for integrating the Measure React Native SDK into iOS applications, allowing developers to utilize Measure's features seamlessly."
    s.homepage         = "https://github.com/measure-sh/measure.git"
    s.license          = { :type => "Apache 2.0", :file => "LICENSE" }
    s.author.          = "measure.sh"
    s.source           = { :path => "." }
    s.platform         = :ios, "12.0"
    s.swift_version    = "5.0"
    s.source_files.    = "ios/**/*.{swift,h,m}"
    s.dependency "React-Core"
    s.dependency 'measure-sh'
  end