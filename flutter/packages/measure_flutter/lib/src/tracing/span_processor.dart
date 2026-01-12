import 'dart:isolate';

import 'package:measure_flutter/src/tracing/span_data.dart';

import '../config/config_provider.dart';
import '../logger/log_level.dart';
import '../logger/logger.dart';
import '../method_channel/signal_processor.dart';
import '../utils/sampler.dart';
import 'internal_span.dart';

abstract class SpanProcessor {
  void onStart(InternalSpan span);

  void onEnding(InternalSpan span);

  void onEnded(InternalSpan span);

  void onConfigLoaded();
}

class MsrSpanProcessor implements SpanProcessor {
  final Logger _logger;
  final SignalProcessor _signalProcessor;
  final ConfigProvider _configProvider;
  final Sampler _sampler;

  // Buffer for spans until config is loaded
  // Once the config is loaded, we flush the buffer and set to null
  List<InternalSpan>? _spansBuffer = [];

  MsrSpanProcessor(
      this._logger,
      this._signalProcessor,
      this._configProvider,
      this._sampler,
      );

  @override
  void onStart(InternalSpan span) {
    _logger.log(LogLevel.debug, "SpanProcessor: span started ${span.name}");
    final threadName = _getCurrentThreadName();
    span.setInternalAttribute(MapEntry("thread_name", threadName));

    // Add to buffer
    _spansBuffer?.add(span);
  }

  @override
  void onEnding(InternalSpan span) {}

  @override
  void onEnded(InternalSpan span) {
    final isConfigLoaded = _spansBuffer == null;

    if (!isConfigLoaded) {
      final spanData = span.toSpanData();
      if (!_sanitizeSpanData(spanData)) {
        _spansBuffer?.remove(span);
        return;
      }
      _logger.log(
        LogLevel.debug,
        "SpanProcessor: span ended: ${span.name}, waiting for config to load for further processing",
      );
      return;
    }

    _processSpan(span);
  }

  @override
  void onConfigLoaded() {
    final pending = _spansBuffer;
    _spansBuffer = null;

    if (pending == null || pending.isEmpty) {
      return;
    }

    _logger.log(
      LogLevel.debug,
      "SpanProcessor: processing ${pending.length} buffered spans",
    );

    for (final span in pending) {
      final shouldSample = _sampler.shouldSampleTrace(span.traceId);
      span.setSamplingRate(shouldSample);

      if (span.hasEnded()) {
        _processSpan(span);
      }
    }
  }

  void _processSpan(InternalSpan span) {
    final spanData = span.toSpanData();
    if (!_sanitizeSpanData(spanData)) {
      return;
    }
    _signalProcessor.trackSpan(spanData);
    _logger.log(
      LogLevel.debug,
      "SpanProcessor: span ended: ${spanData.name}, duration: ${spanData.duration}",
    );
  }

  bool _sanitizeSpanData(SpanData spanData) {
    // Discard span if its duration is negative
    if (spanData.duration < 0) {
      _logger.log(
        LogLevel.error,
        "SpanProcessor: invalid span ${spanData.name}, duration is negative, span will be dropped",
      );
      return false;
    }

    // Discard span if name is blank
    if (spanData.name.trim().isEmpty) {
      _logger.log(
        LogLevel.error,
        "SpanProcessor: span name does not contain any characters, span will be dropped",
      );
      return false;
    }

    // Discard span if it exceeds max span name length
    if (spanData.name.length > _configProvider.maxSpanNameLength) {
      _logger.log(
        LogLevel.error,
        "SpanProcessor: invalid span: ${spanData.name}, length ${spanData.name.length} exceeded max allowed, span will be dropped",
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
        "SpanProcessor: invalid span ${spanData.name}, dropped ${initialSize - spanData.checkpoints.length} checkpoints due to invalid name",
      );
    }

    // Limit number of checkpoints per span
    if (spanData.checkpoints.length > _configProvider.maxCheckpointsPerSpan) {
      _logger.log(
        LogLevel.error,
        "SpanProcessor: invalid span ${spanData.name}, max checkpoints exceeded, some checkpoints will be dropped",
      );
      spanData.checkpoints.removeRange(
        _configProvider.maxCheckpointsPerSpan,
        spanData.checkpoints.length,
      );
    }

    // Remove invalid user-defined attributes
    var droppedAttrsCount = 0;
    spanData.userDefinedAttrs.removeWhere((key, value) {
      final isInvalid = key.length > _configProvider.maxUserDefinedAttributeKeyLength ||
          (value is String && value.length > _configProvider.maxUserDefinedAttributeValueLength);
      if (isInvalid) {
        droppedAttrsCount++;
      }
      return isInvalid;
    });

    if (droppedAttrsCount > 0) {
      _logger.log(
        LogLevel.error,
        "SpanProcessor: invalid span (${spanData.name}) attributes, dropped $droppedAttrsCount attributes due to invalid key or value length",
      );
    }

    // Limit number of user-defined attributes per span
    if (spanData.userDefinedAttrs.length > _configProvider.maxUserDefinedAttributesPerEvent) {
      final excessCount = spanData.userDefinedAttrs.length - _configProvider.maxUserDefinedAttributesPerEvent;
      _logger.log(
        LogLevel.error,
        "SpanProcessor: invalid span (${spanData.name}) attributes, max attributes exceeded, $excessCount attributes will be dropped",
      );
      final keysToKeep = spanData.userDefinedAttrs.keys.take(_configProvider.maxUserDefinedAttributesPerEvent).toList();
      spanData.userDefinedAttrs.removeWhere((key, _) => !keysToKeep.contains(key));
    }

    // Validation passed
    return true;
  }

  String _getCurrentThreadName() {
    final isolate = Isolate.current;
    return isolate.debugName ?? 'unknown';
  }
}