import 'package:flutter/foundation.dart';
import 'package:measure_flutter/src/exception/exception_data.dart';
import 'package:stack_trace/stack_trace.dart';

final class ExceptionFactory {
  const ExceptionFactory._();

  static final _absRegex = RegExp(r'^\s*#[0-9]+ +abs +([A-Fa-f0-9]+)');
  static final _frameRegex = RegExp(r'^\s*#', multiLine: true);
  static final _baseAddrRegex = RegExp(r'isolate_dso_base[:=] *([A-Fa-f0-9]+)');

  static ExceptionData from(FlutterErrorDetails details, bool handled) {
    final result = _parseStackTrace(details.stack);
    final List<Trace> traces = result.traces;
    final String? binaryAddr = result.binaryAddr;
    final type = details.exception.runtimeType.toString();
    final message = _getMessage(details);
    final List<ExceptionUnit> exceptions = [];

    if (traces.isNotEmpty) {
      final firstTrace = traces.first;
      final List<MsrFrame> primaryFrames =
          _createMsrFrames(firstTrace.frames, binaryAddr);
      exceptions.add(
          ExceptionUnit(frames: primaryFrames, type: type, message: message));
    } else {
      exceptions.add(ExceptionUnit(frames: [], type: type, message: message));
    }
    final remainingTraces = traces.skip(1);
    for (Trace trace in remainingTraces) {
      final List<MsrFrame> frames = _createMsrFrames(trace.frames);
      exceptions.add(ExceptionUnit(frames: frames));
    }

    // The foreground property is hard coded to true.
    // Native platforms are expected to update this value.
    // We're not maintaining the application lifecycle state
    // in Flutter.
    return ExceptionData(
        exceptions: exceptions,
        handled: handled,
        threads: [],
        foreground: true);
  }

  static TraceResult _parseStackTrace(dynamic stackTrace) {
    if (stackTrace is Chain) {
      return TraceResult(stackTrace.traces, null);
    } else if (stackTrace is Trace) {
      return TraceResult([stackTrace], null);
    }

    if (stackTrace is StackTrace) {
      stackTrace = stackTrace.toString();
    }

    if (stackTrace is String) {
      final startOffset = _frameRegex.firstMatch(stackTrace)?.start ?? 0;
      final binaryAddr = _baseAddrRegex.firstMatch(stackTrace)?.group(1);
      final chain = Chain.parse(
          startOffset == 0 ? stackTrace : stackTrace.substring(startOffset));
      return TraceResult(chain.traces, binaryAddr);
    }
    return TraceResult([], null);
  }

  static List<MsrFrame> _createMsrFrames(List<Frame> frames,
      [String? binaryAddr]) {
    var index = 0;
    return frames
        .map((frame) {
          if (frame is UnparsedFrame) {
            return _createUnparsedMsrFrame(frame, binaryAddr, index++);
          } else {
            return _createParsedMsrFrame(frame, index++);
          }
        })
        .whereType<MsrFrame>()
        .toList();
  }

  static MsrFrame? _createUnparsedMsrFrame(
      UnparsedFrame frame, String? binaryAddr, int index) {
    final match = _absRegex.firstMatch(frame.member);
    if (match != null) {
      var symbolAddr = match.group(1)!;
      return MsrFrame(
          frameIndex: index,
          binaryAddress: '0x$binaryAddr',
          instructionAddress: '0x${symbolAddr.replaceAll(RegExp(r'^0+'), '')}');
    }
    return null;
  }

  static MsrFrame _createParsedMsrFrame(Frame frame, int index) {
    return MsrFrame(
      className: _extractClassName(frame),
      methodName: _extractMethodName(frame),
      fileName: _extractFileName(frame),
      lineNum: frame.line,
      colNum: frame.column,
      moduleName: _extractModuleName(frame.library),
      frameIndex: index,
    );
  }

  static String _extractFileName(Frame frame) {
    return frame.library.split('/').last;
  }

  static String? _extractMethodName(Frame frame) {
    return (frame.member != null && frame.member!.contains('.'))
        ? frame.member!.substring(frame.member!.indexOf('.') + 1)
        : frame.member;
  }

  static String? _extractClassName(Frame frame) {
    if (frame.member == null) return null;

    final parts = frame.member!.split('.');
    if (parts.length > 1) {
      return parts.sublist(0, parts.length - 1).join('.');
    }
    return null;
  }

  static String? _extractModuleName(String? library) {
    if (library == null) {
      return null;
    }
    int lastSlash = library.lastIndexOf('/');
    if (lastSlash != -1) {
      return library.substring(0, lastSlash + 1);
    }
    return null;
  }

  static String _getMessage(FlutterErrorDetails details) {
    return details.exception.toString();
  }
}

class TraceResult {
  final List<Trace> traces;
  final String? binaryAddr;

  TraceResult(this.traces, this.binaryAddr);
}
