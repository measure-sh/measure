import 'package:flutter/material.dart';

class PlatformWidget extends StatelessWidget {
  final Widget ios;
  final Widget android;

  const PlatformWidget({
    super.key,
    required this.ios,
    required this.android,
  });

  @override
  Widget build(BuildContext context) {
    return Theme.of(context).platform == TargetPlatform.iOS ? ios : android;
  }
}
