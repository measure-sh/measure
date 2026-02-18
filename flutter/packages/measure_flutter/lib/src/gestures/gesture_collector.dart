import 'dart:developer';
import 'dart:isolate';

import 'package:measure_flutter/measure_flutter.dart';
import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/gestures/long_click_data.dart';
import 'package:measure_flutter/src/gestures/scroll_data.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/storage/file_storage.dart';
import 'package:measure_flutter/src/time/time_provider.dart';
import 'package:measure_flutter/src/utils/id_provider.dart';

import '../isolate/file_processor.dart';
import 'click_data.dart';

class GestureCollector {
  final SignalProcessor _signalProcessor;
  final TimeProvider _timeProvider;
  final FileStorage _fileStorage;
  final Logger _logger;
  final IdProvider _idProvider;
  bool _isRegistered = false;

  GestureCollector(
    SignalProcessor signalProcessor,
    TimeProvider timeProvider,
    FileStorage fileStorage,
    Logger logger,
    IdProvider idProvider,
  )   : _signalProcessor = signalProcessor,
        _timeProvider = timeProvider,
        _fileStorage = fileStorage,
        _logger = logger,
        _idProvider = idProvider;

  void register() {
    _isRegistered = true;
  }

  void unregister() {
    _isRegistered = false;
  }

  Future<void> trackGestureClick(
    ClickData data, {
    bool isUserTriggered = false,
    SnapshotNode? snapshot,
    int? timestamp,
  }) async {
    final task = TimelineTask()..start('msr-trackGestureClick');
    try {
      if (!_isRegistered) {
        return;
      }
      MsrAttachment? attachment;
      if (snapshot != null) {
        attachment = await createAttachment(snapshot);
      }
      _signalProcessor.trackEvent(
        data: data,
        type: EventType.gestureClick,
        timestamp: timestamp ?? _timeProvider.now(),
        userDefinedAttrs: {},
        userTriggered: isUserTriggered,
        threadName: Isolate.current.debugName ?? "unknown",
        attachments: attachment != null ? [attachment] : null,
      );
    } finally {
      task.finish();
    }
  }

  void trackGestureScroll(ScrollData scrollData) {
    Timeline.startSync('msr-trackGestureScroll');
    try {
      if (!_isRegistered) {
        return;
      }

      _signalProcessor.trackEvent(
        data: scrollData,
        type: EventType.gestureScroll,
        timestamp: _timeProvider.now(),
        userDefinedAttrs: {},
        userTriggered: false,
        threadName: Isolate.current.debugName ?? "unknown",
      );
    } finally {
      Timeline.finishSync();
    }
  }

  Future<void> trackGestureLongClick(
    LongClickData longClickData, {
    SnapshotNode? snapshot,
    int? timestamp,
  }) async {
    final task = TimelineTask()..start('msr-trackGestureLongClick');
    try {
      if (!_isRegistered) {
        return;
      }
      MsrAttachment? attachment;
      if (snapshot != null) {
        attachment = await createAttachment(snapshot);
      }
      _signalProcessor.trackEvent(
        data: longClickData,
        type: EventType.gestureLongClick,
        timestamp: timestamp ?? _timeProvider.now(),
        userDefinedAttrs: {},
        userTriggered: false,
        threadName: Isolate.current.debugName ?? "unknown",
        attachments: attachment != null ? [attachment] : null,
      );
    } finally {
      task.finish();
    }
  }

  /// Creates an attachment from an already-captured layout snapshot.
  ///
  /// Serializes the [snapshot] to JSON and writes it to a file in an isolate.
  /// Returns an [MsrAttachment] with the file path, or null if the operation fails.
  Future<MsrAttachment?> createAttachment(SnapshotNode snapshot) async {
    try {
      final rootPath = await _fileStorage.getRootPath();
      if (rootPath == null) {
        _logger.log(
          LogLevel.debug,
          'LayoutSnapshotCollector: Root path is null',
        );
        return null;
      }

      final uuid = _idProvider.uuid();
      final result = await writeJsonToFileInIsolate(
        WriteLayoutSnapshotParams(
          snapshot: snapshot,
          fileName: uuid,
          rootPath: rootPath,
          compress: true,
        ),
      );

      final filePath = result.filePath;
      final fileSize = result.size;

      if (filePath == null || fileSize == null) {
        _logger.log(
          LogLevel.debug,
          'LayoutSnapshotCollector: Failed to write JSON file: ${result.error}',
        );
        return null;
      }

      _logger.log(
        LogLevel.debug,
        'LayoutSnapshotCollector: Successfully stored layout snapshot attachment (id: $uuid, size: $fileSize bytes, path: $filePath)',
      );

      return MsrAttachment.fromPath(
        path: filePath,
        type: AttachmentType.layoutSnapshotJson,
        size: fileSize,
        uuid: uuid,
      );
    } catch (e) {
      _logger.log(
        LogLevel.debug,
        'LayoutSnapshotCollector: Error capturing layout snapshot: $e',
      );
      return null;
    }
  }
}
