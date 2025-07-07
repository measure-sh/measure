//
//  MsrRequestHeadersProvider.swift
//  Measure
//
//  Created by Adwin Ross on 27/06/25.
//

import Foundation

/// Provides custom HTTP headers for requests made by the Measure SDK to the Measure API.
///
/// This protocol is primarily intended for self-hosted deployments where additional
/// headers may be required for authentication, routing, or other infrastructure needs.
///
/// Implementations **must be thread-safe** as `getRequestHeaders()` may be called
/// concurrently from multiple threads.
///
/// The following headers are reserved by the SDK and will be ignored if provided:
/// - `Content-Type`
/// - `msr-req-id`
/// - `Authorization`
/// - `Content-Length`
///
/// Example implementation:
///
/// ```swift
/// final class CustomHeaderProvider: MsrRequestHeadersProvider {
///     private var requestHeaders: [String: String] = [:]
///
///     func addHeader(key: String, value: String) {
///         requestHeaders[key] = value
///     }
///
///     func removeHeader(key: String) {
///         requestHeaders.removeValue(forKey: key)
///     }
///
///     func getRequestHeaders() -> [String: String] {
///         return requestHeaders
///     }
/// }
/// ```
public protocol MsrRequestHeadersProvider {
    /// Returns a dictionary of custom HTTP headers to include in Measure SDK requests.
    ///
    /// This method may be called multiple times and from different threads.
    /// Implementations should return a consistent snapshot of headers at the time of the call.
    ///
    /// - Returns: A dictionary of header names to values.
    func getRequestHeaders() -> [String: String]
}
