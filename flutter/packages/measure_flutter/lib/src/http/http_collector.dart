import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/config/config_provider.dart';

import '../events/event_type.dart';
import '../method_channel/signal_processor.dart';
import 'http_data.dart';

class HttpCollector {
  final SignalProcessor signalProcessor;
  final ConfigProvider configProvider;
  bool _enabled = false;

  HttpCollector({
    required this.signalProcessor,
    required this.configProvider,
  });

  void register() {
    _enabled = true;
  }

  void unregister() {
    _enabled = false;
  }

  void trackHttpEvent({
    required String url,
    required HttpMethod method,
    required int startTime,
    int? statusCode,
    int? endTime,
    String? failureReason,
    String? failureDescription,
    Map<String, String>? requestHeaders,
    Map<String, String>? responseHeaders,
    String? requestBody,
    String? responseBody,
    String? client,
  }) {
    if (!_enabled) {
      return;
    }
    if (!configProvider.shouldTrackHttpUrl(url)) {
      return;
    }

    final filteredRequestHeaders =
        requestHeaders != null ? Map.of(requestHeaders) : null;
    final filteredResponseHeaders =
        responseHeaders != null ? Map.of(responseHeaders) : null;

    filteredRequestHeaders?.removeWhere(
      (key, value) => !configProvider.shouldTrackHttpHeader(key),
    );
    filteredResponseHeaders?.removeWhere(
      (key, value) => !configProvider.shouldTrackHttpHeader(key),
    );

    final trackedRequestBody = configProvider.shouldTrackHttpBody(
            url, filteredRequestHeaders?['Content-Type'])
        ? requestBody
        : null;
    final trackedResponseBody = configProvider.shouldTrackHttpBody(
            url, filteredResponseHeaders?['Content-Type'])
        ? responseBody
        : null;

    final data = HttpData(
      url: url,
      method: method.name,
      statusCode: statusCode,
      startTime: startTime,
      endTime: endTime,
      failureReason: failureReason,
      failureDescription: failureDescription,
      requestHeaders: filteredRequestHeaders,
      responseHeaders: filteredResponseHeaders,
      requestBody: trackedRequestBody,
      responseBody: trackedResponseBody,
      client: client ?? 'unknown',
    );
    signalProcessor.trackEvent(
      data: data,
      type: EventType.http,
      timestamp: startTime,
      userDefinedAttrs: {},
      userTriggered: false,
    );
  }
}
