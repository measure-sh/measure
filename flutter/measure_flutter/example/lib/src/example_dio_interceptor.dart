import 'dart:collection';

import 'package:dio/dio.dart';
import 'package:measure_flutter/measure.dart';

class ExampleDioInterceptor extends Interceptor {
  final requests = HashMap<RequestOptions, int>();

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
      final url = request.uri.toString();
      final method = request.method;
      final startTime = requests[request] ?? 0;
      final endTime = DateTime.now().millisecondsSinceEpoch;
      Measure.instance.trackHttpEvent(
        url: url,
        method: method,
        startTime: startTime,
        endTime: endTime,
        statusCode: response.statusCode ?? 0,
      );
    } catch (e) {
      // ignore
    } finally {
      handler.next(response);
    }
  }

  @override
  // ignore: avoid_void_async, strict_raw_type, deprecated_member_use
  void onError(DioError err, ErrorInterceptorHandler handler) async {
    try {
      final request = err.requestOptions;
      final url = request.uri.toString();
      final method = request.method;
      final startTime = requests[request] ?? 0;
      final endTime = DateTime.now().millisecondsSinceEpoch;

      Measure.instance.trackHttpEvent(
        url: url,
        method: method,
        startTime: startTime,
        endTime: endTime,
        failureReason: err.runtimeType.toString(),
        failureDescription: err.message?.toString() ?? '',
      );
    } catch (e) {
      // ignore
    } finally {
      handler.next(err);
    }
  }
}
