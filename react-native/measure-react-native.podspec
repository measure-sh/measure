Pod::Spec.new do |s|
    s.name         = 'measure-react-native'
    s.version      = '0.1.0'
    s.summary      = 'React Native bridge for the Measure SDK'
    s.description  = <<-DESC
      A React Native wrapper for the Measure SDK that enables mobile performance tracking from JavaScript.
    DESC
    s.homepage     = 'https://github.com/your-org/measure'
    s.license      = { :type => 'Apache License, Version 2.0', :file => '../LICENSE' }
    s.authors      = { 'Your Name' => 'you@example.com' }
  
    s.platform     = :ios, '12.0'
    s.source       = { :path => '.' }
  
    s.source_files = 'ios/**/*.{h,m,mm,swift}'
  
    s.dependency 'React-Core'
    s.dependency 'measure-sh'
  
    s.swift_version = '5.0'
  end