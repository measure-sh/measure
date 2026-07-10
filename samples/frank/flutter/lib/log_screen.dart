import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:measure_flutter/measure_flutter.dart';

class LogScreen extends StatefulWidget {
  const LogScreen({super.key});

  @override
  State<LogScreen> createState() => _LogScreenState();
}

class _LogScreenState extends State<LogScreen> {
  final _controller = TextEditingController(text: 'manual log from flutter');
  LogSeverity _severity = LogSeverity.info;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _send() {
    final attrs = AttributeBuilder()..add('retry_count', 3);
    Measure.instance.log(
      _controller.text,
      severity: _severity,
      attributes: attrs.build(),
    );
  }

  String _label(LogSeverity severity) {
    final name = severity.name;
    return name[0].toUpperCase() + name.substring(1);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: Platform.isIOS ? null : AppBar(title: const Text('Track Logs')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _controller,
                decoration: const InputDecoration(
                  labelText: 'Log body',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              Text('Severity', style: theme.textTheme.titleSmall),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: LogSeverity.values.map((severity) {
                  return ChoiceChip(
                    label: Text(_label(severity)),
                    selected: _severity == severity,
                    onSelected: (_) => setState(() => _severity = severity),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _send,
                  child: const Text('Track Log Manually'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
