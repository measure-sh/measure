import 'dart:developer' as developer show log;

import 'package:flutter/cupertino.dart';

class LayoutSnapshotPage extends StatelessWidget {
  const LayoutSnapshotPage({super.key});

  @override
  Widget build(BuildContext context) {
    final brightness = CupertinoTheme.brightnessOf(context);

    return CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        backgroundColor:
            brightness == Brightness.dark ? CupertinoColors.darkBackgroundGray : CupertinoColors.systemBackground,
        middle: Text(
          'Grid Test Widget',
          style: TextStyle(
            color: brightness == Brightness.dark ? CupertinoColors.white : CupertinoColors.black,
          ),
        ),
      ),
      child: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            // Each square is 48px + 4px padding (2px on each side) = 52px total
            const double squareSize = 44.0;
            const double padding = 2.0;
            const double totalItemSize = squareSize + (padding * 2);

            // Calculate how many items can fit per row
            final int crossAxisCount = (constraints.maxWidth / totalItemSize).floor();

            // Fixed total of 5000 items
            const int totalItems = 5000;

            return GridView.builder(
              padding: const EdgeInsets.all(padding),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: crossAxisCount,
                mainAxisSpacing: padding * 2,
                crossAxisSpacing: padding * 2,
                childAspectRatio: 1.0,
              ),
              itemCount: totalItems,
              itemBuilder: (context, index) {
                return GestureDetector(
                  onTap: () {
                    developer.log('Square $index clicked');
                  },
                  child: Container(
                    width: squareSize,
                    height: squareSize,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          // ignore: deprecated_member_use
                          CupertinoColors.systemBlue.withOpacity(0.8),
                          // ignore: deprecated_member_use
                          CupertinoColors.systemPurple.withOpacity(0.8),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          // ignore: deprecated_member_use
                          color: CupertinoColors.systemGrey.withOpacity(0.3),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        '$index',
                        style: const TextStyle(
                          color: CupertinoColors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
