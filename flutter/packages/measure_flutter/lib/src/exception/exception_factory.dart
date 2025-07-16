import 'package:flutter/foundation.dart';
import 'package:measure_flutter/src/exception/exception_data.dart';
import 'package:measure_flutter/src/exception/exception_framework.dart';
import 'package:stack_trace/stack_trace.dart';

final class ExceptionFactory {
  const ExceptionFactory._();

  static final _absRegex = RegExp(r'^\s*#[0-9]+ +abs +([A-Fa-f0-9]+)');
  static final _frameRegex = RegExp(r'^\s*#', multiLine: true);
  static final _baseAddrRegex = RegExp(r'isolate_dso_base[:=] *([A-Fa-f0-9]+)');
  static final _buildIdRegex = RegExp(r"build_id: *'([A-Fa-f0-9]+)'");
  static final _archRegex = RegExp(r'arch[:=] *([A-Za-z0-9]+)');

  static ExceptionData? from(FlutterErrorDetails details, bool handled) {
    var stackTrace = details.stack;
    if (stackTrace == null) {
      return null;
    }
    final result = _parseStackTrace(stackTrace);
    final List<Trace> traces = result.traces;
    final type = details.exception.runtimeType.toString();
    final message = _getMessage(details, type);
    final List<ExceptionUnit> exceptions = [];

    if (traces.isNotEmpty) {
      final firstTrace = traces.first;
      final List<MsrFrame> primaryFrames = _createMsrFrames(firstTrace.frames);
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
      foreground: true,
      binaryImages: _createBinaryImage(stackTrace),
      framework: exceptionFramework,
    );
  }

  static TraceResult _parseStackTrace(dynamic stackTrace) {
    if (stackTrace is Chain) {
      final traces = stackTrace.traces.reversed.toList();
      return TraceResult(traces);
    } else if (stackTrace is Trace) {
      return TraceResult([stackTrace]);
    }

    if (stackTrace is StackTrace) {
      stackTrace = stackTrace.toString();
    }

    if (stackTrace is String) {
      final startOffset = _frameRegex.firstMatch(stackTrace)?.start ?? 0;
      final chain = Chain.parse(
          startOffset == 0 ? stackTrace : stackTrace.substring(startOffset));
      return TraceResult(chain.traces);
    }
    return TraceResult([]);
  }

  static List<MsrFrame> _createMsrFrames(List<Frame> frames) {
    var index = 0;
    bool hasUnparsedFrame =
        frames.any((frame) => frame.member != null && frame is UnparsedFrame);
    return frames
        .where((frame) {
          var member = frame.member;
          return member != null;
        })
        .map((frame) {
          if (hasUnparsedFrame && frame is! UnparsedFrame) {
            return null;
          }

          if (frame is UnparsedFrame) {
            return _createUnparsedMsrFrame(frame, index++);
          } else {
            return _createParsedMsrFrame(frame, index++);
          }
        })
        .whereType<MsrFrame>()
        .toList();
  }

  static MsrFrame? _createUnparsedMsrFrame(UnparsedFrame frame, int index) {
    final match = _absRegex.firstMatch(frame.member);
    if (match != null) {
      var symbolAddr = match.group(1)!;
      return MsrFrame(
          frameIndex: index,
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
    return frame.member;
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

  /// Remove the type from the message if it's present.
  /// Example message — Format Exception: Invalid argument(s): This is an error
  /// Resulting message — Invalid argument(s): This is an error
  static String _getMessage(FlutterErrorDetails details, String type) {
    final String exceptionStr = details.exception.toString();
    if (exceptionStr.startsWith(type) && exceptionStr.length >= type.length) {
      final removedType = exceptionStr.substring(type.length).trim();
      if (removedType.startsWith(": ")) {
        return removedType.substring(2).trim();
      } else {
        return removedType;
      }
    } else {
      return exceptionStr;
    }
  }

  static List<BinaryImage> _createBinaryImage(StackTrace stack) {
    var stackStr = stack.toString();
    final baseAddr = _baseAddrRegex.firstMatch(stackStr)?.group(1);
    final buildId = _buildIdRegex.firstMatch(stackStr)?.group(1);
    final arch = _archRegex.firstMatch(stackStr)?.group(1);
    if (baseAddr != null && buildId != null && arch != null) {
      return [BinaryImage(baseAddr: baseAddr, uuid: buildId, arch: arch)];
    }
    return [];
  }
}

class TraceResult {
  final List<Trace> traces;

  TraceResult(this.traces);
}
