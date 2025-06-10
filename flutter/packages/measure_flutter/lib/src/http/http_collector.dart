import '../events/event_type.dart';
import '../method_channel/signal_processor.dart';
import 'http_data.dart';

class HttpCollector {
  final SignalProcessor signalProcessor;

  HttpCollector({required this.signalProcessor});

  void trackHttpEvent({
    required String url,
    required String method,
    int? statusCode,
    int? startTime,
    int? endTime,
    String? failureReason,
    String? failureDescription,
    Map<String, String>? requestHeaders,
    Map<String, String>? responseHeaders,
    String? requestBody,
    String? responseBody,
    String? client,
  }) {
    final data = HttpData(
      url: url,
      method: method,
      statusCode: statusCode,
      startTime: startTime,
      endTime: endTime,
      failureReason: failureReason,
      failureDescription: failureDescription,
      requestHeaders: requestHeaders,
      responseHeaders: responseHeaders,
      requestBody: requestBody,
      responseBody: responseBody,
      client: client ?? 'unknown',
    );
    signalProcessor.trackEvent(
      data: data,
      type: EventType.http,
      timestamp: _getTimestamp(startTime),
      userDefinedAttrs: {},
      userTriggered: false,
    );
  }

  DateTime _getTimestamp(int? startTime) {
    if (startTime != null) {
      return DateTime.fromMillisecondsSinceEpoch(startTime);
    } else {
      return DateTime.now();
    }
  }
}
