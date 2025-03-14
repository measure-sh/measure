//
//  NetworkInterceptor.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 18/12/24.
//

import Foundation

public struct NetworkInterceptor {
    static var isEnabled = false
    private static let lock = NSLock()

    /// Enables the `NetworkInterceptor` by modifying the provided `URLSessionConfiguration`.
    ///
    /// This method injects the `NetworkInterceptorProtocol` into the `protocolClasses` of the given
    /// `URLSessionConfiguration`. If the interceptor is already enabled, subsequent calls to this
    /// method will have no effect.
    ///
    /// - Parameter sessionConfiguration: The `URLSessionConfiguration` to modify.
    ///
    /// - Note: Ensure you call this method before creating a `URLSession` instance with the given configuration.
    ///
    /// - Example:
    ///   - Swift:
    ///   ```swift
    ///   let config = URLSessionConfiguration.default
    ///   NetworkInterceptor.enable(on: config)
    ///   let session = URLSession(configuration: config)
    ///   ```
    ///
    ///   - Objective-C:
    ///   ```objc
    ///   NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
    ///   [NetworkInterceptor enableOn:config];
    ///   NSURLSession *session = [NSURLSession sessionWithConfiguration:config];
    ///   ```
    ///
    public static func enable(on sessionConfiguration: URLSessionConfiguration) {
        lock.lock()
        defer { lock.unlock() }

        guard !isEnabled else { return }

        sessionConfiguration.protocolClasses = [NetworkInterceptorProtocol.self] + (sessionConfiguration.protocolClasses ?? [])

        isEnabled = true
    }
}
