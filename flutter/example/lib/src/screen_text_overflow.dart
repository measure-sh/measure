import 'package:flutter/material.dart';

class ScreenTextOverflow extends StatelessWidget {
  const ScreenTextOverflow({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Text Overflow Example'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Row(
        children: [
          Container(width: 200),
          Container(width: 200),
        ],
      ),
    );
  }
}
