import 'dart:developer' as developer show log;

import 'package:flutter/material.dart';

class LayoutSnapshotPage extends StatelessWidget {
  const LayoutSnapshotPage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Layout Snapshot')),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            const double squareSize = 44.0;
            const double padding = 2.0;
            const double totalItemSize = squareSize + (padding * 2);
            final int crossAxisCount =
                (constraints.maxWidth / totalItemSize).floor();
            const int totalItems = 5000;

            return GridView.builder(
              padding: const EdgeInsets.all(padding),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: crossAxisCount,
                mainAxisSpacing: padding * 2,
                crossAxisSpacing: padding * 2,
              ),
              itemCount: totalItems,
              itemBuilder: (context, index) {
                return GestureDetector(
                  onTap: () => developer.log('Square $index clicked'),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          theme.colorScheme.primary,
                          theme.colorScheme.tertiary,
                        ],
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        '$index',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onPrimary,
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
