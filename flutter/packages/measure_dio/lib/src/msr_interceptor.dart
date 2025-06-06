import 'dart:collection';
import 'dart:developer' as developer;

import 'package:dio/dio.dart';
import 'package:measure_flutter/measure.dart';
import 'package:measure_flutter/measure_api.dart';

class MsrInterceptor extends Interceptor {
  final requests = HashMap<RequestOptions, int>();
  final MeasureApi _measure;

  MsrInterceptor() : _measure = Measure.instance;

  MsrInterceptor.withMeasure(this._measure);

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    requests[options] = DateTime.now().millisecondsSinceEpoch;
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) async {
    try {
      final request = response.requestOptions;
      final url = _getUrl(request.uri);
      final method = _getMethod(request);
      final startTime = requests[request];
      final endTime = DateTime.now().millisecondsSinceEpoch;
      final requestHeaders = _getRequestHeaders(request);
      final requestBody = _getRequestBody(request);
      final responseHeaders = _getResponseHeaders(response);
      final responseBody = _getResponseBody(response, request.responseType);
      _measure.trackHttpEvent(
        url: url,
        method: method,
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
    }
  }

  @override
  void onError(DioException exception, ErrorInterceptorHandler handler) async {
    try {
      final request = exception.requestOptions;
      final url = _getUrl(request.uri);
      final method = _getMethod(request);
      final startTime = requests[request];
      final endTime = DateTime.now().millisecondsSinceEpoch;
      final failureReason = _getFailureReason(exception);
      final failureDescription = _getFailureDescription(exception);
      _measure.trackHttpEvent(
        url: url,
        method: method,
        startTime: startTime,
        endTime: endTime,
        failureReason: failureReason,
        failureDescription: failureDescription,
        client: 'dio',
      );
    } catch (e, stacktrace) {
      _logInternalError(e, stacktrace);
    } finally {
      handler.next(exception);
    }
  }

  String _getMethod(RequestOptions request) {
    return request.method.toLowerCase();
  }

  String _getUrl(Uri uri) {
    return uri.toString();
  }

  String _getFailureReason(DioException err) {
    if (err.type != DioExceptionType.unknown) {
      return err.type.toString();
    } else {
      return err.runtimeType.toString();
    }
  }

  String? _getFailureDescription(DioException exception) =>
      exception.message ?? exception.error?.toString();

  void _logInternalError(Object e, StackTrace stacktrace) {
    developer.log(
      "Failed to track HTTP event",
      error: e,
      stackTrace: stacktrace,
      name: "measure-dio",
    );
  }

  String? _getResponseBody(
    Response<dynamic> response,
    ResponseType responseType,
  ) {
    final data = response.data;
    if (data == null) {
      return null;
    }
    if (responseType != ResponseType.json) {
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
    return data.toString();
  }

  Map<String, String>? _getRequestHeaders(RequestOptions request) {
    final headers = request.headers;
    if (headers.isEmpty) {
      return null;
    }
    return headers.map((key, value) => MapEntry(key, value.toString()));
  }

  Map<String, String>? _getResponseHeaders(Response<dynamic> response) {
    final headers = response.headers;
    if (headers.isEmpty) {
      return null;
    }
    return headers.map.map((key, value) => MapEntry(key, value.toString()));
  }
}
