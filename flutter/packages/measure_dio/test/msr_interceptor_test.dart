import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:measure_dio/measure_dio.dart';
import 'package:measure_flutter/measure_flutter.dart';

import 'fake_measure.dart';

void main() {
  late Dio dio;
  late DioAdapter dioAdapter;
  late FakeMeasure measure;

  setUp(() {
    measure = FakeMeasure();

    // enable all tracking by default
    measure.setShouldTrackHttpRequestBody(true);
    measure.setShouldTrackHttpResponseBody(true);
    measure.setShouldTrackHttpHeader(true);
    measure.setShouldTrackHttpUrl(true);

    dio = Dio(BaseOptions(baseUrl: 'https://example.com'));
    dioAdapter = DioAdapter(dio: dio);
    dio.httpClientAdapter = dioAdapter;

    dio.interceptors.add(MsrInterceptor.withMeasure(measure));
  });

  tearDown(() {
    measure.clear();
  });

  test('tracks GET request on success', () async {
    const path = '/hello';
    final responseData = {'message': 'Success!'};

    dioAdapter.onGet(path, (server) => server.reply(200, responseData));

    final response = await dio.get(path);

    expect(response.statusCode, 200);
    expect(measure.trackedHttp.length, 1);

    final httpCall = measure.trackedHttp.first;
    expect(httpCall.url, 'https://example.com$path');
    expect(httpCall.method, HttpMethod.get);
    expect(httpCall.statusCode, 200);
    expect(httpCall.startTime, isNotNull);
    expect(httpCall.endTime, isNotNull);
    expect(httpCall.client, 'dio');
  });

  test('tracks POST request on success', () async {
    const path = '/post-test';
    final responseData = {'result': 'created'};

    dioAdapter.onPost(path, (server) => server.reply(201, responseData));

    final response = await dio.post(path);

    expect(response.statusCode, 201);
    expect(measure.trackedHttp.length, 1);

    final httpCall = measure.trackedHttp.first;
    expect(httpCall.url, 'https://example.com$path');
    expect(httpCall.method, HttpMethod.post);
    expect(httpCall.statusCode, 201);
    expect(httpCall.client, 'dio');
  });

  test("tracks request headers", () async {
    const path = '/headers';
    final responseData = {'message': 'Success!'};
    final requestHeaders = {'x-custom-header': 'value'};

    dioAdapter.onGet(
      path,
      headers: requestHeaders,
      (server) => server.reply(200, responseData),
    );

    final response = await dio.get(
      path,
      options: Options(headers: requestHeaders),
    );

    expect(response.statusCode, 200);
    expect(measure.trackedHttp.length, 1);
    expect(measure.trackedHttp.first.requestHeaders, requestHeaders);
  });

  test("tracks response headers", () async {
    const path = '/headers';
    final responseData = {'message': 'Success!'};
    final responseHeaders = {'content-type': 'application/json'};

    dioAdapter.onGet(path, (server) => server.reply(200, responseData));

    final response = await dio.get(path);

    expect(response.statusCode, 200);
    expect(measure.trackedHttp.length, 1);
    expect(measure.trackedHttp.first.responseHeaders, responseHeaders);
  });

  test("joins multiple values of a response header", () async {
    const path = '/multi-header';
    final responseData = {'message': 'Success!'};

    dioAdapter.onGet(
      path,
      (server) => server.reply(
        200,
        responseData,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
          'cache-control': ['no-store', 'no-cache'],
        },
      ),
    );

    await dio.get(path);

    expect(measure.trackedHttp.length, 1);
    final responseHeaders = measure.trackedHttp.first.responseHeaders;
    expect(responseHeaders?['cache-control'], 'no-store, no-cache');
    // The body is only tracked when the content type is a plain JSON value.
    expect(
        responseHeaders?[Headers.contentTypeHeader], Headers.jsonContentType);
  });

  test("tracks request body", () async {
    const path = '/post-test';
    final requestBody = {'name': 'John Doe'};
    final responseData = {'result': 'created'};

    dioAdapter.onPost(
      path,
      data: requestBody,
      (server) => server.reply(201, responseData),
    );
    final response = await dio.post(path, data: requestBody);

    expect(response.statusCode, 201);
    expect(measure.trackedHttp.length, 1);
    expect(measure.trackedHttp.first.requestBody, '{"name":"John Doe"}');
  });

  test("tracks response body", () async {
    const path = '/post-test';
    final responseBody = {'message': 'Success!'};

    dioAdapter.onPost(path, (server) => server.reply(201, responseBody));
    final response = await dio.post(path);

    expect(response.statusCode, 201);
    expect(measure.trackedHttp.length, 1);
    expect(measure.trackedHttp.first.responseBody, '{"message":"Success!"}');
  });

  test('tracks HTTP error', () async {
    const path = '/fail';

    dio.httpClientAdapter = _TimeoutAdapter();

    try {
      await dio.get(path);
    } catch (_) {
      // Expected to fail
    }

    expect(measure.trackedHttp.length, 1);

    final httpCall = measure.trackedHttp.first;
    expect(httpCall.url, 'https://example.com$path');
    expect(httpCall.method, HttpMethod.get);
    expect(httpCall.statusCode, isNull);
    expect(httpCall.failureReason, "DioExceptionType.connectionTimeout");
    expect(httpCall.failureDescription, 'timeout');
    expect(httpCall.client, 'dio');
  });

  test('truncates response body over 256KB', () async {
    const path = '/large';
    final responseData = {'data': 'a' * (300 * 1024)};

    dioAdapter.onGet(path, (server) => server.reply(200, responseData));

    await dio.get(path);

    final responseBody = measure.trackedHttp.first.responseBody!;
    expect(
      responseBody,
      '{"data":"${'a' * (256 * 1024 - 9)}'
      '\n... [Body truncated - exceeded 256KB limit]',
    );
  });

  test('tracks 4xx response with status code, headers and body', () async {
    const path = '/missing';
    final responseData = {'message': 'Not found'};

    dioAdapter.onGet(path, (server) => server.reply(404, responseData));

    await expectLater(dio.get(path), throwsA(isA<DioException>()));

    expect(measure.trackedHttp.length, 1);
    final httpCall = measure.trackedHttp.first;
    expect(httpCall.statusCode, 404);
    expect(httpCall.failureReason, isNull);
    expect(httpCall.failureDescription, isNull);
    expect(httpCall.responseHeaders, {'content-type': 'application/json'});
    expect(httpCall.responseBody, '{"message":"Not found"}');
  });

  test('tracks json response body for plain response type', () async {
    const path = '/plain-json';
    final responseData = {'message': 'Success!'};

    dioAdapter.onGet(path, (server) => server.reply(200, responseData));

    await dio.get(path, options: Options(responseType: ResponseType.plain));

    expect(measure.trackedHttp.length, 1);
    expect(measure.trackedHttp.first.responseBody, '{"message":"Success!"}');
  });

  test('handles response with non-JSON type', () async {
    const path = '/bytes';
    final responseBytes = [1, 2, 3];

    dioAdapter.onGet(path, (server) => server.reply(200, responseBytes));

    await dio.get(path, options: Options(responseType: ResponseType.bytes));

    expect(measure.trackedHttp.length, 1);

    final httpCall = measure.trackedHttp.first;
    expect(httpCall.url, 'https://example.com$path');
    expect(httpCall.method, HttpMethod.get);
    expect(httpCall.statusCode, 200);
    expect(httpCall.startTime, isNotNull);
    expect(httpCall.endTime, isNotNull);
    expect(httpCall.requestHeaders, isNull);
    expect(httpCall.requestBody, isNull);
    expect(httpCall.responseHeaders, isNotNull);
    expect(httpCall.responseBody, isNull);
    expect(httpCall.client, 'dio');
  });

  group('filtering tests', () {
    test('does not track event if url is disabled for tracking', () async {
      const path = '/hello';
      final responseData = {'message': 'Success!'};

      measure.setShouldTrackHttpUrl(false);

      dioAdapter.onGet(path, (server) => server.reply(200, responseData));
      await dio.get(path);

      expect(measure.trackedHttp.length, 0);
    });

    test('passes blocked headers on to measure', () async {
      const path = '/headers';
      final responseData = {'message': 'Success!'};

      measure.setShouldTrackHttpHeader(false);

      dioAdapter.onGet(path, (server) => server.reply(200, responseData));

      await dio.get(path);

      // Measure removes blocked headers after it checks the content type.
      expect(measure.trackedHttp.length, 1);
      expect(
        measure.trackedHttp.first.responseHeaders,
        {'content-type': 'application/json'},
      );
      expect(measure.trackedHttp.first.responseBody, '{"message":"Success!"}');
    });

    test('does not track request body when disabled', () async {
      const path = '/headers';
      final responseData = {'message': 'Success!'};
      final requestHeaders = {'x-custom-header': 'value'};

      measure.setShouldTrackHttpRequestBody(false);

      dioAdapter.onPost(
        path,
        headers: requestHeaders,
        (server) => server.reply(200, responseData),
      );

      await dio.post(path, options: Options(headers: requestHeaders));

      expect(measure.trackedHttp.length, 1);
      final httpCall = measure.trackedHttp.first;
      expect(httpCall.requestBody, isNull);
    });

    test('does not track response body when disabled', () async {
      const path = '/headers';
      final responseData = {'message': 'Success!'};
      final requestHeaders = {'x-custom-header': 'value'};

      measure.setShouldTrackHttpResponseBody(false);

      dioAdapter.onPost(
        path,
        headers: requestHeaders,
        (server) => server.reply(200, responseData),
      );

      await dio.post(path, options: Options(headers: requestHeaders));

      expect(measure.trackedHttp.length, 1);
      final httpCall = measure.trackedHttp.first;
      expect(httpCall.responseBody, isNull);
    });

    test('does not track headers if request body is disabled for tracking',
        () async {
      const path = '/hello';
      final responseData = {'message': 'Success!'};
      measure.setShouldTrackHttpRequestBody(false);

      dioAdapter.onGet(
        path,
        (server) => server.reply(200, responseData, headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        }),
      );
      await dio.get(path);

      expect(measure.trackedHttp.length, 1);
      final httpCall = measure.trackedHttp.first;
      expect(httpCall.requestHeaders, isNull);
    });

    test('does not track headers if response body is disabled for tracking',
        () async {
      const path = '/hello';
      final responseData = {'message': 'Success!'};

      measure.setShouldTrackHttpResponseBody(false);

      dioAdapter.onGet(
        path,
        (server) => server.reply(200, responseData, headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        }),
      );
      await dio.get(path);

      expect(measure.trackedHttp.length, 1);
      final httpCall = measure.trackedHttp.first;
      expect(httpCall.responseHeaders, isNull);
    });
  });
}

class _TimeoutAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    throw DioException(
      requestOptions: options,
      type: DioExceptionType.connectionTimeout,
      message: 'timeout',
    );
  }

  @override
  void close({bool force = false}) {}
}
