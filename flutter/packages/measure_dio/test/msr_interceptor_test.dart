import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:measure_dio/measure_dio.dart';

import 'fake_measure.dart';

void main() {
  late Dio dio;
  late DioAdapter dioAdapter;
  late FakeMeasure measure;

  setUp(() {
    measure = FakeMeasure();

    // enable all tracking by default
    measure.setShouldTrackHttpBody(true);
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
    expect(httpCall.method, 'get');
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
    expect(httpCall.method, 'post');
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
    final responseHeaders = {'content-type': '[application/json]'};

    dioAdapter.onGet(path, (server) => server.reply(200, responseData));

    final response = await dio.get(path);

    expect(response.statusCode, 200);
    expect(measure.trackedHttp.length, 1);
    expect(measure.trackedHttp.first.responseHeaders, responseHeaders);
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
    expect(measure.trackedHttp.first.requestBody, requestBody.toString());
  });

  test("tracks response body", () async {
    const path = '/post-test';
    final responseBody = {'message': 'Success!'};

    dioAdapter.onPost(path, (server) => server.reply(201, responseBody));
    final response = await dio.post(path);

    expect(response.statusCode, 201);
    expect(measure.trackedHttp.length, 1);
    expect(measure.trackedHttp.first.responseBody, responseBody.toString());
  });

  test('tracks HTTP error', () async {
    const path = '/fail';

    dioAdapter.onGet(
      path,
      (server) => server.throws(
        500,
        DioException(
          requestOptions: RequestOptions(path: 'https://example.com$path'),
          type: DioExceptionType.connectionTimeout,
          message: 'timeout',
        ),
      ),
    );

    try {
      await dio.get(path);
    } catch (_) {
      // Expected to fail
    }

    expect(measure.trackedHttp.length, 1);

    final httpCall = measure.trackedHttp.first;
    expect(httpCall.url, 'https://example.com$path');
    expect(httpCall.method, 'get');
    expect(httpCall.statusCode, isNull);
    expect(httpCall.failureReason, "DioExceptionType.connectionTimeout");
    expect(httpCall.failureDescription, null);
    expect(httpCall.client, 'dio');
  });

  test('handles response with non-JSON type', () async {
    const path = '/text';
    const responseText = 'plain text response';

    dioAdapter.onGet(path, (server) => server.reply(200, responseText));

    await dio.get(path, options: Options(responseType: ResponseType.plain));

    expect(measure.trackedHttp.length, 1);

    final httpCall = measure.trackedHttp.first;
    expect(httpCall.url, 'https://example.com$path');
    expect(httpCall.method, 'get');
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

    test('does not track request headers when disabled', () async {
      const path = '/headers';
      final responseData = {'message': 'Success!'};
      final requestHeaders = {'x-custom-header': 'value'};

      measure.setShouldTrackHttpHeader(false);

      dioAdapter.onGet(
        path,
        headers: requestHeaders,
        (server) => server.reply(200, responseData),
      );

      await dio.get(path, options: Options(headers: requestHeaders));

      expect(measure.trackedHttp.length, 1);
      final httpCall = measure.trackedHttp.first;
      expect(httpCall.requestHeaders, isNull);
      expect(httpCall.responseHeaders, isNull);
    });

    test('does not track body when disabled', () async {
      const path = '/headers';
      final responseData = {'message': 'Success!'};
      final requestHeaders = {'x-custom-header': 'value'};

      measure.setShouldTrackHttpBody(false);

      dioAdapter.onPost(
        path,
        headers: requestHeaders,
        (server) => server.reply(200, responseData),
      );

      await dio.post(path, options: Options(headers: requestHeaders));

      expect(measure.trackedHttp.length, 1);
      final httpCall = measure.trackedHttp.first;
      expect(httpCall.requestBody, isNull);
      expect(httpCall.responseBody, isNull);
    });
  });
}
