# Dio instrumentation for measure.sh

This package works along with `measure_flutter`, and provides a interceptor for Dio which can be
used to automatically track `http` events.

## Usage

This package provides `MsrInterceptor` that can automatically track network requests done
using Dio.

```dart
final dio = Dio();
dio.interceptors.add(MsrInterceptor());
```

Checkout our [documentation](https://github.com/measure-sh/measure/tree/main/docs) for more details
and features.
