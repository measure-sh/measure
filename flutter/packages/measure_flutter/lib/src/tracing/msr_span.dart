import 'package:measure_flutter/src/tracing/span_processor.dart';

import '../logger/log_level.dart';
import '../logger/logger.dart';
import '../utils/id_provider.dart';
import 'checkpoint.dart';
import 'internal_span.dart';
import 'span.dart';
import 'span_data.dart';
import 'span_status.dart';

/// A thread-safe implementation of [Span].
class MsrSpan implements InternalSpan {
  MsrSpan._({
    required Logger logger,
    required this.isSampled,
    required String name,
    required this.spanId,
    required String traceId,
    required String? parentId,
    required String sessionId,
    required this.startTime,
    SpanProcessor? spanProcessor,
  })  : _logger = logger,
        _name = name,
        _traceId = traceId,
        _parentId = parentId,
        _sessionId = sessionId,
        _spanProcessor = spanProcessor;

  final Logger _logger;
  final SpanProcessor? _spanProcessor;
  String _name;
  String _traceId;
  String? _parentId;
  final String _sessionId;
  SpanStatus _status = SpanStatus.unset;
  int _endTime = 0;
  bool _hasEnded = false;
  final List<Checkpoint> _checkpoints = <Checkpoint>[];
  final Map<String, dynamic> _attributes = <String, dynamic>{};
  final Map<String, dynamic> _userDefinedAttrs = <String, dynamic>{};

  @override
  final String spanId;

  @override
  final int startTime;

  @override
  final bool isSampled;

  @override
  String get traceId => _traceId;

  @override
  String? get parentId => _parentId;

  @override
  String get name => _name;

  @override
  String get sessionId => _sessionId;

  @override
  List<Checkpoint> get checkpoints => List.unmodifiable(_checkpoints);

  @override
  Map<String, dynamic> get attributes => Map.unmodifiable(_attributes);

  /// Creates and starts a new span.
  static Span startSpan({
    required String name,
    required Logger logger,
    required IdProvider idProvider,
    SpanProcessor? spanProcessor,
    String? sessionId,
    Span? parentSpan,
    int? timestamp,
    bool? isSampled,
  }) {
    final startTime = timestamp ?? DateTime.now().millisecondsSinceEpoch;
    final spanId = idProvider.spanId();
    final traceId = parentSpan?.traceId ?? idProvider.traceId();
    final sessionIdValue = sessionId ?? 'default-session';
    final sampledValue = parentSpan?.isSampled ?? isSampled ?? true;

    final span = MsrSpan._(
      logger: logger,
      name: name,
      spanId: spanId,
      traceId: traceId,
      parentId: parentSpan?.spanId,
      sessionId: sessionIdValue,
      startTime: startTime,
      isSampled: sampledValue,
      spanProcessor: spanProcessor,
    );

    spanProcessor?.onStart(span);
    return span;
  }

  @override
  SpanStatus getStatus() => _status;

  @override
  Span setStatus(SpanStatus status) {
    if (_hasEnded) {
      _logger.log(
        LogLevel.error,
        'Failed to update span: attempt to set status after span ended',
      );
      return this;
    }
    _status = status;
    return this;
  }

  @override
  Span setParent(Span parentSpan) {
    if (_hasEnded) {
      _logger.log(
        LogLevel.error,
        'Failed to update span: attempt to set parent after span ended',
      );
      return this;
    }
    _parentId = parentSpan.spanId;
    _traceId = parentSpan.traceId;
    return this;
  }

  @override
  Span setCheckpoint(String name) {
    if (_hasEnded) {
      _logger.log(
        LogLevel.error,
        'Failed to update span: attempt to set checkpoint after span ended',
      );
      return this;
    }
    final checkpoint = Checkpoint(name, DateTime.now().millisecondsSinceEpoch);
    _checkpoints.add(checkpoint);
    return this;
  }

  @override
  Span setName(String name) {
    if (_hasEnded) {
      _logger.log(
        LogLevel.error,
        'Failed to update span: attempt to set name after span ended',
      );
      return this;
    }
    _name = name;
    return this;
  }

  @override
  Span setAttribute(String key, String value) {
    if (_hasEnded) {
      _logger.log(
        LogLevel.error,
        'Failed to update span: attempt to set attribute after span ended',
      );
      return this;
    }
    _userDefinedAttrs[key] = value;
    return this;
  }

  @override
  Span setIntAttribute(String key, int value) {
    if (_hasEnded) {
      _logger.log(
        LogLevel.error,
        'Failed to update span: attempt to set attribute after span ended',
      );
      return this;
    }
    _userDefinedAttrs[key] = value;
    return this;
  }

  @override
  Span setDoubleAttribute(String key, double value) {
    if (_hasEnded) {
      _logger.log(
        LogLevel.error,
        'Failed to update span: attempt to set attribute after span ended',
      );
      return this;
    }
    _userDefinedAttrs[key] = value;
    return this;
  }

  @override
  Span setBoolAttribute(String key, bool value) {
    if (_hasEnded) {
      _logger.log(
        LogLevel.error,
        'Failed to update span: attempt to set attribute after span ended',
      );
      return this;
    }
    _userDefinedAttrs[key] = value;
    return this;
  }

  @override
  Span setAttributes(Map<String, dynamic> attributes) {
    if (_hasEnded) {
      _logger.log(
        LogLevel.error,
        'Failed to update span: attempt to set attributes after span ended',
      );
      return this;
    }
    _userDefinedAttrs.addAll(attributes);
    return this;
  }

  @override
  Span removeAttribute(String key) {
    if (_hasEnded) {
      _logger.log(
        LogLevel.error,
        'Failed to update span: attempt to remove attribute after span ended',
      );
      return this;
    }
    _userDefinedAttrs.remove(key);
    return this;
  }

  @override
  Span end({int? timestamp}) {
    _endSpanInternal(timestamp ?? DateTime.now().millisecondsSinceEpoch);
    return this;
  }

  @override
  bool hasEnded() => _hasEnded;

  void _endSpanInternal(int timestamp) {
    if (_hasEnded) {
      _logger.log(
        LogLevel.error,
        'Failed to update span: attempt to end an already ended span',
      );
      return;
    }
    _endTime = timestamp;
    _hasEnded = true;
    _spanProcessor?.onEnding(this);
    _spanProcessor?.onEnded(this);
  }

  @override
  int getDuration() {
    if (!_hasEnded) {
      _logger.log(
        LogLevel.error,
        'Failed to get duration of a span($_name): span has not ended',
      );
      return 0;
    }
    return _endTime - startTime;
  }

  @override
  void setInternalAttribute(String key, dynamic value) {
    if (!_hasEnded) {
      _attributes[key] = value;
    } else {
      _logger.log(
        LogLevel.error,
        'Failed to update span: attempt to set attribute after span ended',
      );
    }
  }

  @override
  Map<String, dynamic> getAttributesMap() => Map.from(_attributes);

  @override
  Map<String, dynamic> getUserDefinedAttrs() => Map.from(_userDefinedAttrs);

  @override
  SpanData toSpanData() {
    return SpanData(
      spanId: spanId,
      traceId: traceId,
      name: _name,
      startTime: startTime,
      endTime: _endTime,
      status: _status,
      hasEnded: _hasEnded,
      parentId: parentId,
      sessionId: _sessionId,
      checkpoints: List.from(_checkpoints),
      attributes: Map.from(_attributes),
      userDefinedAttrs: Map.from(_userDefinedAttrs),
      duration: _hasEnded ? _endTime - startTime : 0,
      isSampled: isSampled,
    );
  }
}
