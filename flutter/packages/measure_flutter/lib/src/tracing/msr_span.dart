import 'package:measure_flutter/src/time/time_provider.dart';
import 'package:measure_flutter/src/tracing/span.dart';
import 'package:measure_flutter/src/tracing/span_data.dart';
import 'package:measure_flutter/src/tracing/span_processor.dart';
import 'package:measure_flutter/src/tracing/span_status.dart';
import 'package:measure_flutter/src/tracing/trace_sampler.dart';

import '../attribute_value.dart';
import '../logger/log_level.dart';
import '../logger/logger.dart';
import '../utils/id_provider.dart';
import 'checkpoint.dart';
import 'internal_span.dart';

/// An implementation of [Span] for Dart.
class MsrSpan implements InternalSpan {
  final Logger _logger;
  final SpanProcessor _spanProcessor;
  final TimeProvider _timeProvider;

  @override
  final bool isSampled;

  @override
  String name;

  @override
  final String spanId;

  @override
  String traceId;

  @override
  String? parentId;

  @override
  final int startTime;

  SpanStatus _status = SpanStatus.unset;
  int _endTime = 0;
  _EndState _hasEnded = _EndState.notEnded;

  @override
  final List<Checkpoint> checkpoints = <Checkpoint>[];

  @override
  final Map<String, dynamic> attributes = <String, dynamic>{};

  final Map<String, dynamic> _userDefinedAttrs = <String, dynamic>{};

  MsrSpan({
    required Logger logger,
    required SpanProcessor spanProcessor,
    required TimeProvider timeProvider,
    required this.isSampled,
    required this.name,
    required this.spanId,
    required this.traceId,
    required this.parentId,
    required this.startTime,
  })  : _logger = logger,
        _spanProcessor = spanProcessor,
        _timeProvider = timeProvider;

  static Span startSpan({
    required String name,
    required Logger logger,
    required SpanProcessor spanProcessor,
    required IdProvider idProvider,
    required TraceSampler traceSampler,
    required TimeProvider timeProvider,
    Span? parentSpan,
    int? timestamp,
  }) {
    final startTime = timestamp ?? timeProvider.now();
    final spanId = idProvider.spanId();
    final traceId = parentSpan?.traceId ?? idProvider.traceId();
    final isSampled = parentSpan?.isSampled ?? traceSampler.shouldSample();

    final span = MsrSpan(
      logger: logger,
      spanProcessor: spanProcessor,
      timeProvider: timeProvider,
      name: name,
      spanId: spanId,
      traceId: traceId,
      parentId: parentSpan?.spanId,
      startTime: startTime,
      isSampled: isSampled,
    );

    spanProcessor.onStart(span);
    return span;
  }

  @override
  SpanStatus getStatus() {
    return _status;
  }

  @override
  Span setStatus(SpanStatus status) {
    if (_hasEnded != _EndState.notEnded) {
      _logger.log(
        LogLevel.error,
        "Failed to update span: attempt to set status after span ended",
      );
      return this;
    }
    _status = status;
    return this;
  }

  @override
  Span setParent(Span parentSpan) {
    if (_hasEnded != _EndState.notEnded) {
      _logger.log(
        LogLevel.error,
        "Failed to update span: attempt to set parent after span ended",
      );
      return this;
    }
    parentId = parentSpan.spanId;
    traceId = parentSpan.traceId;
    return this;
  }

  @override
  Span setCheckpoint(String name) {
    if (_hasEnded != _EndState.notEnded) {
      _logger.log(
        LogLevel.error,
        "Failed to update span: attempt to set checkpoint after span ended",
      );
      return this;
    }
    final checkpoint = Checkpoint(name: name, timestamp: _timeProvider.now());
    checkpoints.add(checkpoint);
    return this;
  }

  @override
  Span setName(String name) {
    if (_hasEnded != _EndState.notEnded) {
      _logger.log(
        LogLevel.error,
        "Failed to update span: attempt to set name after span ended",
      );
      return this;
    }
    this.name = name;
    return this;
  }

  @override
  Span setAttributeString(String key, String value) {
    if (_hasEnded != _EndState.notEnded) {
      _logger.log(
        LogLevel.error,
        "Failed to update span: attempt to set attribute after span ended",
      );
      return this;
    }
    _userDefinedAttrs[key] = value;
    return this;
  }

  @override
  Span setAttributeInt(String key, int value) {
    if (_hasEnded != _EndState.notEnded) {
      _logger.log(
        LogLevel.error,
        "Failed to update span: attempt to set attribute after span ended",
      );
      return this;
    }
    _userDefinedAttrs[key] = value;
    return this;
  }

  @override
  Span setAttributeDouble(String key, double value) {
    if (_hasEnded != _EndState.notEnded) {
      _logger.log(
        LogLevel.error,
        "Failed to update span: attempt to set attribute after span ended",
      );
      return this;
    }
    _userDefinedAttrs[key] = value;
    return this;
  }

  @override
  Span setAttributeBool(String key, bool value) {
    if (_hasEnded != _EndState.notEnded) {
      _logger.log(
        LogLevel.error,
        "Failed to update span: attempt to set attribute after span ended",
      );
      return this;
    }
    _userDefinedAttrs[key] = value;
    return this;
  }

  @override
  Span setAttributes(Map<String, AttributeValue> attributes) {
    if (_hasEnded != _EndState.notEnded) {
      _logger.log(
        LogLevel.error,
        "Failed to update span: attempt to set attribute after span ended",
      );
      return this;
    }
    attributes.forEach((key, value) {
      _userDefinedAttrs[key] = value.value;
    });
    return this;
  }

  @override
  Span removeAttribute(String key) {
    if (_hasEnded != _EndState.notEnded) {
      _logger.log(
        LogLevel.error,
        "Failed to update span: attempt to set attribute after span ended",
      );
      return this;
    }
    _userDefinedAttrs.remove(key);
    return this;
  }

  @override
  Span end() {
    _endSpanInternal(_timeProvider.now());
    return this;
  }

  @override
  Span endWithTimestamp(int timestamp) {
    _endSpanInternal(timestamp);
    return this;
  }

  @override
  bool hasEnded() {
    return _hasEnded != _EndState.notEnded;
  }

  void _endSpanInternal(int timestamp) {
    if (_hasEnded != _EndState.notEnded) {
      _logger.log(
        LogLevel.error,
        "Failed to update span: attempt to end and already ended span",
      );
      return;
    }
    _endTime = timestamp;
    _hasEnded = _EndState.ending;

    _spanProcessor.onEnding(this);

    _hasEnded = _EndState.ended;

    _spanProcessor.onEnded(this);
  }

  @override
  int getDuration() {
    if (_hasEnded != _EndState.ended) {
      _logger.log(
        LogLevel.error,
        "Failed to get duration of a span($name): span has not ended",
      );
      return 0;
    } else {
      return _calculateDuration();
    }
  }

  @override
  void setInternalAttribute(MapEntry<String, dynamic> attribute) {
    // Attributes are set after the span ends, hence
    // no check for span status.
    attributes[attribute.key] = attribute.value;
  }

  @override
  Map<String, dynamic> getAttributesMap() {
    return Map<String, dynamic>.from(attributes);
  }

  @override
  Map<String, dynamic> getUserDefinedAttrs() {
    return Map<String, dynamic>.from(_userDefinedAttrs);
  }

  @override
  SpanData toSpanData() {
    return SpanData(
      spanId: spanId,
      traceId: traceId,
      name: name,
      startTime: startTime,
      endTime: _endTime,
      status: _status,
      hasEnded: _hasEnded == _EndState.ended,
      parentId: parentId,
      checkpoints: List<Checkpoint>.from(checkpoints),
      userDefinedAttrs: Map<String, dynamic>.from(_userDefinedAttrs),
      duration: _calculateDuration(),
      isSampled: isSampled,
      attributes: attributes,
    );
  }

  int _calculateDuration() {
    return _endTime - startTime;
  }
}

enum _EndState {
  notEnded,
  ending,
  ended,
}
