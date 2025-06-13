import 'dart:isolate';

import '../config/config_provider.dart';
import '../logger/log_level.dart';
import '../logger/logger.dart';
import '../method_channel/signal_processor.dart';
import 'internal_span.dart';
import 'span_data.dart';

/// Interface for processing span lifecycle events.
abstract class SpanProcessor {
  void onStart(InternalSpan span);

  void onEnding(InternalSpan span);

  void onEnded(InternalSpan span);
}

/// Default implementation of [SpanProcessor].
class MsrSpanProcessor implements SpanProcessor {
  MsrSpanProcessor({
    required Logger logger,
    required SignalProcessor signalProcessor,
    required ConfigProvider configProvider,
  })  : _logger = logger,
        _signalProcessor = signalProcessor,
        _configProvider = configProvider;

  final Logger _logger;
  final SignalProcessor _signalProcessor;
  final ConfigProvider _configProvider;

  @override
  void onStart(InternalSpan span) {
    _logger.log(LogLevel.debug, 'Span started: ${span.name}');
    span.setInternalAttribute('thread_name', _getCurrentIsolateName());
  }

  @override
  void onEnding(InternalSpan span) {}

  @override
  void onEnded(InternalSpan span) {
    final spanData = span.toSpanData();
    if (!_sanitize(spanData)) {
      return;
    }
    _signalProcessor.trackSpan(spanData);
    _logger.log(LogLevel.debug,
        'Span ended: ${spanData.name}, duration: ${spanData.duration}');
  }

  bool _sanitize(SpanData spanData) {
    // Discard span if duration is negative
    if (spanData.duration < 0) {
      _logger.log(
        LogLevel.error,
        'Invalid span: ${spanData.name}, duration is negative, span will be dropped',
      );
      return false;
    }

    // Discard span if it exceeds max span name length
    if (spanData.name.length > _configProvider.maxSpanNameLength) {
      _logger.log(
        LogLevel.error,
        'Invalid span: ${spanData.name}, length ${spanData.name.length} exceeded max allowed, span will be dropped',
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
        'Invalid span: ${spanData.name}, dropped ${initialSize - spanData.checkpoints.length} checkpoints due to invalid name',
      );
    }

    // Limit number of checkpoints per span
    if (spanData.checkpoints.length > _configProvider.maxCheckpointsPerSpan) {
      _logger.log(
        LogLevel.error,
        'Invalid span: ${spanData.name}, max checkpoints exceeded, some checkpoints will be dropped',
      );
      spanData.checkpoints.removeRange(
          _configProvider.maxCheckpointsPerSpan, spanData.checkpoints.length);
    }

    // Validation passed
    return true;
  }

  String _getCurrentIsolateName() {
    return Isolate.current.debugName ?? 'main-isolate';
  }
}
