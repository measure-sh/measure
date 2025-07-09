import 'dart:collection';
import 'dart:developer' as developer;

import 'package:dio/dio.dart';
import 'package:measure_flutter/measure.dart';

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
    _requestsStartTime[options] = Measure.instance.getCurrentTime();
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) async {
    if (!_measure.shouldTrackHttpUrl(response.requestOptions.uri.toString())) {
      handler.next(response);
      return;
    }

    try {
      final request = response.requestOptions;
      final url = _getRequestUrl(request);
      final method = _getMethod(request);
      final startTime = _requestsStartTime[request];
      final endTime = Measure.instance.getCurrentTime();
      final requestHeaders = _getRequestHeaders(request);
      final requestBody = _getRequestBody(request);
      final responseHeaders = _getResponseHeaders(response);
      final responseBody = _getResponseBody(response, request);

      if (startTime == null) {
        developer.log("Failed to track http event, unable to get start time");
        return;
      }

      _measure.trackHttpEvent(
        url: url,
        method: HttpMethod.fromString(method),
        startTime: startTime,
        endTime: endTime,
        statusCode: response.statusCode,
        requestHeaders: requestHeaders,
        requestBody: requestBody,
        responseHeaders: responseHeaders,
        responseBody: responseBody,
        client: 'dio',
      );
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
      final request = err.requestOptions;
      final url = _getRequestUrl(request);
      final method = _getMethod(request);
      // The start time should never be null, but this happens in tests
      // hence setting a default value.
      final startTime =
          _requestsStartTime[request] ?? Measure.instance.getCurrentTime();
      final endTime = Measure.instance.getCurrentTime();
      final failureReason = _getFailureReason(err);
      final failureDescription = _getFailureDescription(err);

      _measure.trackHttpEvent(
        url: url,
        method: HttpMethod.fromString(method),
        startTime: startTime,
        endTime: endTime,
        failureReason: failureReason,
        failureDescription: failureDescription,
        client: 'dio',
      );
    } catch (e, stacktrace) {
      _logInternalError(e, stacktrace);
    } finally {
      handler.next(err);
      _requestsStartTime.remove(err.requestOptions);
    }
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
    if (request.responseType != ResponseType.json) {
      return null;
    }
    final url = _getRequestUrl(request);
    if (!_measure.shouldTrackHttpBody(url, request.contentType)) {
      return null;
    }
    return data.toString();
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
    final contentType = request.headers['content-type']?.toString();

    if (!_measure.shouldTrackHttpBody(url, contentType)) {
      return null;
    }

    return data.toString();
  }

  Map<String, String>? _getRequestHeaders(RequestOptions request) {
    final headers = request.headers;
    if (headers.isEmpty) {
      return null;
    }

    final filteredHeaders = <String, String>{};

    for (final entry in headers.entries) {
      if (_measure.shouldTrackHttpHeader(entry.key)) {
        filteredHeaders[entry.key] = entry.value.toString();
      }
    }

    return filteredHeaders.isEmpty ? null : filteredHeaders;
  }

  Map<String, String>? _getResponseHeaders(Response<dynamic> response) {
    final headers = response.headers;
    if (headers.isEmpty) {
      return null;
    }

    final filteredHeaders = <String, String>{};

    for (final entry in headers.map.entries) {
      if (_measure.shouldTrackHttpHeader(entry.key)) {
        filteredHeaders[entry.key] = entry.value.toString();
      }
    }

    return filteredHeaders.isEmpty ? null : filteredHeaders;
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
