import 'package:http/http.dart' as http;
import 'package:measure_flutter/measure.dart';

class ExampleHttpClient extends http.BaseClient {
  final http.Client client;

  ExampleHttpClient(this.client);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final startTime = DateTime.now();
    final method = request.method;
    try {
      final response = await client.send(request);
      final endTime = DateTime.now();
      Measure.instance.trackHttpEvent(
        url: request.url.toString(),
        method: method,
        startTime: startTime.millisecondsSinceEpoch,
        endTime: endTime.millisecondsSinceEpoch,
        statusCode: response.statusCode,
        requestBody: null,
        requestHeaders: null,
        responseBody: null,
        responseHeaders: null,
        client: client.runtimeType.toString(),
      );
      return response;
    } on http.ClientException catch (e) {
      final endTime = DateTime.now();
      Measure.instance.trackHttpEvent(
        url: request.url.toString(),
        method: method,
        startTime: startTime.millisecondsSinceEpoch,
        endTime: endTime.millisecondsSinceEpoch,
        failureReason: e.runtimeType.toString(),
        failureDescription: e.message,
      );
      rethrow;
    }
  }
}
