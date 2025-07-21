/// Enumeration of HTTP methods supported for tracking network requests.
/// 
/// [HttpMethod] represents the standard HTTP methods that can be tracked
/// by the Measure SDK when monitoring network requests.
/// 
/// **Usage:**
/// ```dart
/// Measure.instance.trackHttpEvent(
///   url: 'https://api.example.com/users',
///   method: HttpMethod.get,  // or HttpMethod.post, etc.
///   startTime: startTime,
///   endTime: endTime,
///   statusCode: 200,
/// );
/// ```
enum HttpMethod {
  /// HTTP GET method for retrieving data
  get,
  /// HTTP POST method for creating data  
  post,
  /// HTTP PUT method for updating/replacing data
  put,
  /// HTTP DELETE method for removing data
  delete,
  /// HTTP PATCH method for partial updates
  patch,
  /// Fallback for unrecognized HTTP methods
  unknown;

  /// Converts a string representation to an [HttpMethod].
  /// 
  /// **Parameters:**
  /// - [value]: The HTTP method string (case-insensitive)
  /// 
  /// **Returns:** The corresponding [HttpMethod], or [HttpMethod.unknown] if not recognized
  /// 
  /// **Example:**
  /// ```dart
  /// final method = HttpMethod.fromString('GET'); // Returns HttpMethod.get
  /// final unknown = HttpMethod.fromString('CUSTOM'); // Returns HttpMethod.unknown
  /// ```
  static HttpMethod fromString(String value) {
    switch (value.toLowerCase()) {
      case 'get':
        return HttpMethod.get;
      case 'post':
        return HttpMethod.post;
      case 'put':
        return HttpMethod.put;
      case 'delete':
        return HttpMethod.delete;
      case 'patch':
        return HttpMethod.patch;
      default:
        return HttpMethod.unknown;
    }
  }
}

