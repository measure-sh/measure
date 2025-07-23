Pod::Spec.new do |s|
    s.name             = "MeasureReactNative"
    s.version          = "0.1.0"
    s.summary          = "A simple native bridge for the Measure React Native SDK"
    s.description      = "Logs the API key passed from JavaScript to native Swift."
    s.homepage         = "https://your-github-url.com"
    s.license          = { :type => "Apache 2.0", :file => "LICENSE" }
    s.author           = { "Your Name" => "your@email.com" }
    s.source           = { :path => "." }
  
    s.platform     = :ios, "12.0"
    s.swift_version = "5.0"
  
    s.source_files = "ios/**/*.{swift,h,m}"
    s.dependency "React-Core"
  end