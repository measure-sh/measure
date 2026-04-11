import 'package:flutter/material.dart';

class BottomNavDemo extends StatefulWidget {
  const BottomNavDemo({super.key});

  @override
  State<BottomNavDemo> createState() => _BottomNavDemoState();
}

class _BottomNavDemoState extends State<BottomNavDemo> {
  int _selectedIndex = 0;

  static const _pages = <Widget>[
    _TabPage(title: 'Home', icon: Icons.home),
    _TabPage(title: 'Profile', icon: Icons.person),
    _TabPage(title: 'Settings', icon: Icons.settings),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Bottom Nav Demo')),
      body: _pages[_selectedIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (i) => setState(() => _selectedIndex = i),
        indicatorColor: theme.colorScheme.primaryContainer,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.person), label: 'Profile'),
          NavigationDestination(icon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}

class _TabPage extends StatelessWidget {
  final String title;
  final IconData icon;
  const _TabPage({required this.title, required this.icon});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 48, color: theme.colorScheme.primary),
          const SizedBox(height: 16),
          Text(
            title,
            style: theme.textTheme.headlineMedium?.copyWith(
              color: theme.colorScheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}
