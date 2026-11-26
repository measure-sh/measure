import 'dart:collection';
import 'dart:convert';
import 'dart:developer' as developer;

import 'package:dio/dio.dart';
import 'package:measure_flutter/measure_flutter.dart';

/// A Dio [Interceptor] that tracks HTTP events, optionally with headers and
/// body.
///
/// To use, create an instance of [MsrInterceptor] and add it to your Dio
/// instance. For example:
/// ```dart
/// final dio = Dio();
/// dio.interceptors.add(MsrInterceptor());
/// ```
class MsrInterceptor extends Interceptor {
  static const _maxBodySizeBytes = 256 * 1024;
  static const _bodyTruncatedMessage =
      '\n... [Body truncated - exceeded 256KB limit]';

  final _requestsStartTime = HashMap<RequestOptions, int>();
  final MeasureApi _measure;

  /// Creates a new [MsrInterceptor] that tracks HTTP events.
  MsrInterceptor() : _measure = Measure.instance;

  /// Creates a new [MsrInterceptor] that tracks HTTP events. Used for
  /// injecting a custom [MeasureApi] instance. Used for testing.
  MsrInterceptor.withMeasure(this._measure);

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    _requestsStartTime[options] = _measure.getCurrentTime();
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) async {
    try {
      _trackResponse(response);
    } catch (e, stacktrace) {
      _logInternalError(e, stacktrace);
    } finally {
      handler.next(response);
      _requestsStartTime.remove(response.requestOptions);
    }
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    try {
      // dio throws for 4xx and 5xx responses, which still have a response.
      final response = err.response;
      if (response != null) {
        _trackResponse(response);
      } else {
        _trackFailure(err);
      }
    } catch (e, stacktrace) {
      _logInternalError(e, stacktrace);
    } finally {
      handler.next(err);
      _requestsStartTime.remove(err.requestOptions);
    }
  }

  void _trackResponse(Response response) {
    final request = response.requestOptions;
    final url = _getRequestUrl(request);
    if (!_measure.shouldTrackHttpEvent(url)) {
      return;
    }

    final startTime = _requestsStartTime[request];
    if (startTime == null) {
      developer.log("Failed to track http event, unable to get start time");
      return;
    }

    _measure.trackHttpEvent(
      url: url,
      method: HttpMethod.fromString(_getMethod(request)),
      startTime: startTime,
      endTime: _measure.getCurrentTime(),
      statusCode: response.statusCode,
      requestHeaders: _getRequestHeaders(request),
      requestBody: _getRequestBody(request),
      responseHeaders: _getResponseHeaders(request, response),
      responseBody: _getResponseBody(response, request),
      client: 'dio',
    );
  }

  void _trackFailure(DioException err) {
    final request = err.requestOptions;
    final startTime = _requestsStartTime[request];
    if (startTime == null) {
      developer.log("Failed to track http event, unable to get start time");
      return;
    }

    _measure.trackHttpEvent(
      url: _getRequestUrl(request),
      method: HttpMethod.fromString(_getMethod(request)),
      startTime: startTime,
      endTime: _measure.getCurrentTime(),
      failureReason: _getFailureReason(err),
      failureDescription: _getFailureDescription(err),
      client: 'dio',
    );
  }

  String _getMethod(RequestOptions request) {
    return request.method.toLowerCase();
  }

  String _getFailureReason(DioException err) {
    if (err.type != DioExceptionType.unknown) {
      return err.type.toString();
    } else {
      return err.runtimeType.toString();
    }
  }

  String? _getFailureDescription(DioException err) =>
      err.message ?? err.error?.toString();

  String? _getResponseBody(Response<dynamic> response, RequestOptions request) {
    final data = response.data;
    if (data == null) {
      return null;
    }
    // Bytes and stream responses are never JSON text.
    if (request.responseType == ResponseType.bytes ||
        request.responseType == ResponseType.stream) {
      return null;
    }
    final url = _getRequestUrl(request);
    if (!_measure.shouldTrackHttpResponseBody(url)) {
      return null;
    }
    return _bodyToString(data);
  }

  String? _getRequestBody(RequestOptions request) {
    final data = request.data;
    if (data == null) {
      return null;
    }
    if (request.method == 'GET') {
      return null;
    }

    final url = _getRequestUrl(request);

    if (!_measure.shouldTrackHttpRequestBody(url)) {
      return null;
    }

    return _bodyToString(data);
  }

  /// Returns the body as JSON text, or null when it can't be encoded, such
  /// as `FormData`.
  String? _bodyToString(dynamic data) {
    if (data is String) {
      return _truncate(data);
    }
    try {
      return _truncate(jsonEncode(data));
    } on JsonUnsupportedObjectError {
      return null;
    }
  }

  String _truncate(String body) {
    final bytes = utf8.encode(body);
    if (bytes.length <= _maxBodySizeBytes) {
      return body;
    }
    final kept = utf8.decode(
      bytes.sublist(0, _maxBodySizeBytes),
      allowMalformed: true,
    );
    return '$kept$_bodyTruncatedMessage';
  }

  Map<String, String>? _getRequestHeaders(RequestOptions request) {
    final headers = request.headers;
    if (headers.isEmpty) {
      return null;
    }

    final trackedHeaders = <String, String>{};
    final url = _getRequestUrl(request);

    if (_measure.shouldTrackHttpRequestBody(url)) {
      for (final entry in headers.entries) {
        trackedHeaders[entry.key] = _headerValue(entry.value);
      }
    }

    return trackedHeaders.isEmpty ? null : trackedHeaders;
  }

  Map<String, String>? _getResponseHeaders(
      RequestOptions request, Response<dynamic> response) {
    final headers = response.headers;
    if (headers.isEmpty) {
      return null;
    }

    final trackedHeaders = <String, String>{};

    final url = _getRequestUrl(request);

    if (_measure.shouldTrackHttpResponseBody(url)) {
      for (final entry in headers.map.entries) {
        trackedHeaders[entry.key] = _headerValue(entry.value);
      }
    }

    return trackedHeaders.isEmpty ? null : trackedHeaders;
  }

  /// Joins a list of header values with `, `.
  String _headerValue(dynamic value) {
    if (value is List) {
      return value.map((item) => item.toString()).join(', ');
    }
    return value.toString();
  }

  String _getRequestUrl(RequestOptions request) {
    return request.uri.toString();
  }

  void _logInternalError(Object e, StackTrace stacktrace) {
    developer.log(
      "Failed to track HTTP event",
      error: e,
      stackTrace: stacktrace,
      name: "measure-dio",
    );
  }
}
