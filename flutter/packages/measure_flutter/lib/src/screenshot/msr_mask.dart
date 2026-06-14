import 'package:flutter/widgets.dart';

/// Wraps [child] to always redact it from screenshots regardless of the
/// configured screenshot mask level.
///
/// ```dart
/// MsrMask(
///   child: AccountBalance(amount: balance),
/// )
/// ```
class MsrMask extends StatelessWidget {
  final Widget child;

  const MsrMask({super.key, required this.child});

  @override
  Widget build(BuildContext context) => child;
}
