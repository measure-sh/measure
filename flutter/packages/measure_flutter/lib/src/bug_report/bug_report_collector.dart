import 'package:measure_flutter/src/events/event_type.dart';
import 'package:measure_flutter/src/logger/log_level.dart';
import 'package:measure_flutter/src/method_channel/signal_processor.dart';
import 'package:measure_flutter/src/time/time_provider.dart';
import 'package:measure_flutter/src/utils/id_provider.dart';

import '../../measure.dart';
import '../logger/logger.dart';
import '../storage/file_storage.dart';
import 'bug_report_data.dart';

class BugReportCollector {
  final Logger _logger;
  final SignalProcessor _signalProcessor;
  final TimeProvider _timeProvider;
  final IdProvider _idProvider;
  final FileStorage _fileStorage;

  const BugReportCollector({
    required Logger logger,
    required SignalProcessor signalProcessor,
    required TimeProvider timeProvider,
    required IdProvider idProvider,
    required FileStorage fileStorage,
  })
      : _logger = logger,
        _signalProcessor = signalProcessor,
        _idProvider = idProvider,
        _timeProvider = timeProvider,
        _fileStorage = fileStorage;

  Future<void> trackBugReport(String description,
      List<MsrAttachment> attachments,
      Map<String, AttributeValue> attributes) async {
    try {
      final storedAttachments = <MsrAttachment>[];
      for (var attachment in attachments) {
        final bytes = attachment.bytes;
        if (bytes == null) {
          continue;
        }
        final uuid = _idProvider.uuid();
        final file = await _fileStorage.writeFile(bytes, uuid);
        if (file != null) {
          storedAttachments.add(
            MsrAttachment(
              name: uuid,
              path: file.path,
              type: AttachmentType.screenshot,
              id: uuid,
              size: bytes.length,
              bytes: null,
            ),
          );
        }
      }
      final data = BugReportData(description: description);
      _signalProcessor.trackEvent(
        data: data,
        type: EventType.bugReport,
        timestamp: DateTime.now(),
        userDefinedAttrs: attributes,
        userTriggered: true,
        attachments: storedAttachments,
      );
    } catch (e, stacktrace) {
      _logger.log(LogLevel.error, 'Error tracking bug report', e, stacktrace);
    }
  }
}
