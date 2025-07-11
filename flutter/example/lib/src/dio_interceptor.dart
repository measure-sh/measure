import 'package:dio/dio.dart';
import 'package:measure_flutter/measure_flutter.dart';

class TraceHeaderInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Start a new span for the HTTP request
    final span = Measure.instance.startSpan("http");

    // Get the trace parent header key and value
    final key = Measure.instance.getTraceParentHeaderKey();
    final value = Measure.instance.getTraceParentHeaderValue(span);

    // Add the trace header to the request
    options.headers[key] = value;

    // Store the span in extra data so we can finish it later
    options.extra['trace_span'] = span;
    super.onRequest(options, handler);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final span = response.requestOptions.extra['trace_span'];
    span?.end();
    super.onResponse(response, handler);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final span = err.requestOptions.extra['trace_span'];
    span?.end();
    super.onError(err, handler);
  }
}