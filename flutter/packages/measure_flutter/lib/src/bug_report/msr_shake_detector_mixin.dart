import 'package:flutter/cupertino.dart';

import '../../measure_flutter.dart';

/// A mixin that enables automatic shake detection for displaying bug reports.
/// 
/// [MsrShakeDetectorMixin] automatically sets up and manages shake detection
/// lifecycle for StatefulWidget classes. It automatically enables shake detection
/// when the widget is initialized and disables it when disposed.
/// 
/// **Usage:**
/// ```dart
/// class MyHomeScreen extends StatefulWidget {
///   @override
///   _MyHomeScreenState createState() => _MyHomeScreenState();
/// }
/// 
/// class _MyHomeScreenState extends State<MyHomeScreen> 
///     with MsrShakeDetectorMixin<MyHomeScreen> {
///     
///   @override
///   void onShakeDetected() {
///     // Navigate to bug report screen
///     Navigator.of(context).push(
///       MaterialPageRoute(
///         builder: (context) => Scaffold(
///           body: Measure.instance.createBugReportWidget(
///             attributes: AttributeBuilder()
///                 .add('screen', 'HomeScreen')
///                 .add('user_type', 'premium')
///                 .build(),
///           ),
///         ),
///       ),
///     );
///   }
/// 
///   @override
///   Widget build(BuildContext context) {
///     return Scaffold(
///       appBar: AppBar(title: Text('Home')),
///       body: Center(child: Text('Shake device to report bugs')),
///     );
///   }
/// }
/// ```
mixin MsrShakeDetectorMixin<T extends StatefulWidget> on State<T> {
  /// Called when a shake gesture is detected.
  /// 
  /// Override this method to define what happens when the user shakes their device.
  /// Typically used to navigate to a bug report screen or show a feedback form.
  void onShakeDetected();

  @override
  void initState() {
    super.initState();
    enableShakeDetection();
  }

  /// Enables shake detection by registering the shake listener with the SDK.
  /// 
  /// This is automatically called during [initState].
  void enableShakeDetection() {
    Measure.instance.setShakeListener(onShakeDetected);
  }

  /// Disables shake detection by removing the shake listener from the SDK.
  /// 
  /// This is automatically called during [dispose].
  void disableShakeDetection() {
    Measure.instance.setShakeListener(null);
  }

  @override
  void dispose() {
    disableShakeDetection();
    super.dispose();
  }
}
