import 'dart:async';
import 'dart:isolate';

import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/logger/logger.dart';

import '../gestures/snapshot_node.dart';
import 'file_processor.dart';

const Duration _initTimeout = Duration(seconds: 10);
const Duration _writeTimeout = Duration(seconds: 30);

/// Request types for the file processing isolate
sealed class FileProcessingRequest {
  final String requestId;
  final SendPort responsePort;

  FileProcessingRequest({
    required this.requestId,
    required this.responsePort,
  });
}

/// Request to compress an image and save to file
class ImageCompressionRequest extends FileProcessingRequest {
  final CompressAndSaveParams params;

  ImageCompressionRequest({
    required super.requestId,
    required super.responsePort,
    required this.params,
  });
}

/// Request to serialize JSON and save to file
class LayoutSnapshotWriteRequest extends FileProcessingRequest {
  final SnapshotNode snapshot;
  final String fileName;
  final String rootPath;
  final bool compress;

  LayoutSnapshotWriteRequest({
    required super.requestId,
    required super.responsePort,
    required this.snapshot,
    required this.fileName,
    required this.rootPath,
    required this.compress,
  });
}

/// Response from the file processing isolate
class FileProcessingResponse {
  final String requestId;
  final FileProcessingResult result;

  FileProcessingResponse({
    required this.requestId,
    required this.result,
  });
}

/// Manages a persistent isolate for file processing operations
///
/// This isolate handles expensive operations like JSON serialization and
/// image compression off the main thread, improving UI performance.
class FileProcessingIsolate {
  final Logger _logger;
  Isolate? _isolate;
  SendPort? _sendPort;
  ReceivePort? _receivePort;
  final Map<String, Completer<FileProcessingResult>> _pendingRequests = {};
  bool _isInitialized = false;

  FileProcessingIsolate({required Logger logger}) : _logger = logger;

  /// Initialize the persistent isolate worker
  Future<void> init() async {
    if (_isInitialized) {
      return;
    }

    try {
      _receivePort = ReceivePort();
      final receivePort = _receivePort;

      if (receivePort == null) {
        throw StateError('Failed to create ReceivePort');
      }

      // Spawn the isolate
      _isolate = await Isolate.spawn(
        _isolateWorker,
        receivePort.sendPort,
        debugName: 'MeasureFileProcessing',
      );

      // Wait for the isolate to send its SendPort and then handle all subsequent messages
      final completer = Completer<SendPort>();

      receivePort.listen(
        (message) {
          if (message is SendPort && !completer.isCompleted) {
            // First message is the SendPort
            completer.complete(message);
          } else {
            // All subsequent messages are responses
            _handleResponse(message);
          }
        },
        onError: (Object error, StackTrace stackTrace) {
          _logger.log(
            LogLevel.error,
            'FileProcessingIsolate: Error in receive port: $error',
            error,
            stackTrace,
          );
          if (!completer.isCompleted) {
            completer.completeError(error, stackTrace);
          }
        },
        onDone: () {
          if (!completer.isCompleted) {
            completer.completeError(
              StateError('Receive port closed before initialization'),
            );
          }
        },
      );

      _sendPort = await completer.future.timeout(
        _initTimeout,
        onTimeout: () {
          throw TimeoutException('Failed to initialize file processing isolate');
        },
      );

      _isInitialized = true;
    } catch (e, stackTrace) {
      _logger.log(
        LogLevel.error,
        'FileProcessingIsolate: Failed to initialize: $e',
        e,
        stackTrace,
      );
      await dispose();
    }
  }

  /// Dispose the isolate and clean up resources
  Future<void> dispose() async {
    // Complete all pending requests with error
    for (final completer in _pendingRequests.values) {
      if (!completer.isCompleted) {
        completer.complete(
          const FileProcessingResult(
            error: 'Isolate disposed before request completed',
          ),
        );
      }
    }
    _pendingRequests.clear();

    _isolate?.kill(priority: Isolate.immediate);
    _isolate = null;
    _receivePort?.close();
    _receivePort = null;
    _sendPort = null;
    _isInitialized = false;
  }

  /// Process image compression request
  Future<FileProcessingResult> processImageCompression(
    CompressAndSaveParams params,
  ) async {
    if (!_isInitialized || _sendPort == null) {
      return const FileProcessingResult(
        error: 'Isolate not initialized',
      );
    }

    final requestId = params.fileName;
    final completer = Completer<FileProcessingResult>();
    _pendingRequests[requestId] = completer;

    final sendPort = _sendPort;
    final receivePort = _receivePort;

    if (sendPort == null || receivePort == null) {
      return const FileProcessingResult(
        error: 'Isolate ports not available',
      );
    }

    try {
      sendPort.send(
        ImageCompressionRequest(
          requestId: requestId,
          responsePort: receivePort.sendPort,
          params: params,
        ),
      );

      // Wait for response with timeout
      return await completer.future.timeout(
        _writeTimeout,
        onTimeout: () {
          return const FileProcessingResult(
            error: 'Image compression timed out',
          );
        },
      );
    } catch (e, stackTrace) {
      _logger.log(
        LogLevel.error,
        'FileProcessingIsolate: Error processing image: $e',
        e,
        stackTrace,
      );
      return FileProcessingResult(error: e.toString());
    } finally {
      _pendingRequests.remove(requestId);
    }
  }

  /// Process JSON write request
  Future<FileProcessingResult> processLayoutSnapshotWrite(
    SnapshotNode snapshot,
    String fileName,
    String rootPath, {
    bool compress = true,
  }) async {
    if (!_isInitialized || _sendPort == null) {
      return const FileProcessingResult(
        error: 'Isolate not initialized',
      );
    }

    final requestId = fileName;
    final completer = Completer<FileProcessingResult>();
    _pendingRequests[requestId] = completer;

    final sendPort = _sendPort;
    final receivePort = _receivePort;

    if (sendPort == null || receivePort == null) {
      return const FileProcessingResult(
        error: 'Isolate ports not available',
      );
    }

    try {
      sendPort.send(
        LayoutSnapshotWriteRequest(
          requestId: requestId,
          responsePort: receivePort.sendPort,
          snapshot: snapshot,
          fileName: fileName,
          rootPath: rootPath,
          compress: compress,
        ),
      );

      // Wait for response with timeout
      return await completer.future.timeout(
        _writeTimeout,
        onTimeout: () {
          return const FileProcessingResult(
            error: 'JSON write timed out',
          );
        },
      );
    } catch (e, stackTrace) {
      _logger.log(
        LogLevel.error,
        'FileProcessingIsolate: Error processing JSON: $e',
        e,
        stackTrace,
      );
      return FileProcessingResult(error: e.toString());
    } finally {
      _pendingRequests.remove(requestId);
    }
  }

  /// Handle responses from the isolate
  void _handleResponse(Object? message) {
    if (message is FileProcessingResponse) {
      final completer = _pendingRequests[message.requestId];
      if (completer != null && !completer.isCompleted) {
        completer.complete(message.result);
      }
    } else {
      _logger.log(
        LogLevel.warning,
        'FileProcessingIsolate: Received unexpected message type: ${message.runtimeType}',
      );
    }
  }

  /// Isolate worker entry point
  static void _isolateWorker(SendPort mainSendPort) {
    final receivePort = ReceivePort();

    // Send our SendPort to the main isolate
    mainSendPort.send(receivePort.sendPort);

    // Listen for requests
    receivePort.listen((message) async {
      if (message is ImageCompressionRequest) {
        await _handleImageCompression(message);
      } else if (message is LayoutSnapshotWriteRequest) {
        await _handleJsonWrite(message);
      }
    });
  }

  /// Handle image compression in isolate
  static Future<void> _handleImageCompression(
    ImageCompressionRequest request,
  ) async {
    try {
      final result = await compressAndSaveInIsolateWorker(request.params);

      request.responsePort.send(
        FileProcessingResponse(
          requestId: request.requestId,
          result: result,
        ),
      );
    } catch (e) {
      request.responsePort.send(
        FileProcessingResponse(
          requestId: request.requestId,
          result: FileProcessingResult(error: e.toString()),
        ),
      );
    }
  }

  /// Handle JSON write in isolate
  static Future<void> _handleJsonWrite(LayoutSnapshotWriteRequest request) async {
    try {
      final result = await writeJsonToFileInIsolateWorker(
        request.snapshot,
        request.fileName,
        request.rootPath,
        request.compress,
      );

      request.responsePort.send(
        FileProcessingResponse(
          requestId: request.requestId,
          result: result,
        ),
      );
    } catch (e) {
      request.responsePort.send(
        FileProcessingResponse(
          requestId: request.requestId,
          result: FileProcessingResult(error: e.toString()),
        ),
      );
    }
  }
}
