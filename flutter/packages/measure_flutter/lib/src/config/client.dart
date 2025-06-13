/// Identifiers required to connect to the Measure backend.
///
/// This class is used when initializing the Measure SDK via `Measure.start(...)`.
/// It provides the SDK with the necessary credentials and endpoint to send data.
///
/// Example:
/// ```dart
/// final clientInfo = ClientInfo(
///   apiKey: 'your-api-key',
///   apiUrl: 'https://localhost:8080',
/// );
///
/// await Measure.start(
///   clientInfo: clientInfo,
///   config: MeasureConfig(...),
/// );
/// ```
///
/// - [apiKey]: The API key assigned to your project. This can be found in the Measure dashboard.
/// - [apiUrl]: An optional endpoint where data should be sent.
class ClientInfo {
  final String apiKey;
  final String apiUrl;

  /// Creates a new [ClientInfo] instance.
  ///
  /// Used to authenticate and configure the SDK connection to the Measure backend.
  ///
  /// - [apiKey] is required and identifies your app in the Measure dashboard.
  /// - [apiUrl] must be a valid URL. For self-host users this URL is available
  ///   in the Measure dashboard. While for SaaS users this field is not
  ///   required.
  ClientInfo({
    required this.apiKey,
    this.apiUrl = "https://api.measure.sh",
  });

  Map<String, String> toJson() {
    return {
      'apiKey': apiKey,
      'apiUrl': apiUrl,
    };
  }
}
