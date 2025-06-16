import 'dart:isolate';

import 'package:measure_flutter/src/tracing/span_data.dart';

import '../config/config_provider.dart';
import '../logger/log_level.dart';
import '../logger/logger.dart';
import '../method_channel/signal_processor.dart';
import 'internal_span.dart';

abstract class SpanProcessor {
  void onStart(InternalSpan span);

  void onEnding(InternalSpan span);

  void onEnded(InternalSpan span);
}

class MsrSpanProcessor implements SpanProcessor {
  final Logger _logger;
  final SignalProcessor _signalProcessor;
  final ConfigProvider _configProvider;

  MsrSpanProcessor(
    this._logger,
    this._signalProcessor,
    this._configProvider,
  );

  @override
  void onStart(InternalSpan span) {
    _logger.log(LogLevel.debug, "Span started: ${span.name}");
    final threadName = _getCurrentThreadName();
    span.setInternalAttribute(MapEntry("thread_name", threadName));
  }

  @override
  void onEnding(InternalSpan span) {}

  @override
  void onEnded(InternalSpan span) {
    if (!span.isSampled) {
      // discard spans that have not been sampled
      return;
    }

    final spanData = span.toSpanData();
    if (!_sanitizeSpanData(spanData)) {
      return;
    }
    _signalProcessor.trackSpan(spanData);
    _logger.log(LogLevel.debug,
        "Span ended: ${spanData.name}, duration: ${spanData.duration}");
  }

  bool _sanitizeSpanData(SpanData spanData) {
    // Discard span if its duration is negative
    if (spanData.duration < 0) {
      _logger.log(
        LogLevel.error,
        "Invalid span: ${spanData.name}, duration is negative, span will be dropped",
      );
      return false;
    }

    // Discard span if it exceeds max span name length
    if (spanData.name.length > _configProvider.maxSpanNameLength) {
      _logger.log(
        LogLevel.error,
        "Invalid span: ${spanData.name}, length ${spanData.name.length} exceeded max allowed, span will be dropped",
      );
      return false;
    }

    // Remove invalid checkpoints
    final initialSize = spanData.checkpoints.length;
    spanData.checkpoints.removeWhere((checkpoint) =>
        checkpoint.name.length > _configProvider.maxCheckpointNameLength);

    if (spanData.checkpoints.length < initialSize) {
      _logger.log(
        LogLevel.error,
        "Invalid span: ${spanData.name}, dropped ${initialSize - spanData.checkpoints.length} checkpoints due to invalid name",
      );
    }

    // Limit number of checkpoints per span
    if (spanData.checkpoints.length > _configProvider.maxCheckpointsPerSpan) {
      _logger.log(
        LogLevel.error,
        "Invalid span: ${spanData.name}, max checkpoints exceeded, some checkpoints will be dropped",
      );
      spanData.checkpoints.removeRange(
        _configProvider.maxCheckpointsPerSpan,
        spanData.checkpoints.length,
      );
    }
    return true;
  }

  String _getCurrentThreadName() {
    final isolate = Isolate.current;
    return isolate.debugName ?? 'unknown';
  }
}
