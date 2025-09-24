import 'package:flutter/material.dart';

/// Text configuration for customizing the bug report UI labels and messages.
/// 
/// [BugReportText] allows you to customize all user-facing text in the
/// bug report widget to match your app's tone or support localization.
/// 
/// **Example:**
/// ```dart
/// final customText = BugReportText(
///   appBarTitle: 'Send Feedback',
///   sendButton: 'Submit',
///   inputPlaceHolder: 'Tell us what went wrong...',
///   addFromGalleryButton: 'Add Image',
/// );
/// ```
@immutable
class BugReportText {
  final String appBarTitle;
  final String sendButton;
  final String inputPlaceHolder;
  final String addFromGalleryButton;

  const BugReportText({
    this.appBarTitle = 'Report a Bug',
    this.sendButton = 'Send',
    this.inputPlaceHolder = 'Briefly describe the issue you are facing',
    this.addFromGalleryButton = 'Add from Gallery',
  });

  BugReportText copyWith({
    String? appBarTitle,
    String? sendButton,
    String? inputPlaceHolder,
    String? addFromGalleryButton,
    String? maxScreenshotsMessage,
  }) {
    return BugReportText(
      appBarTitle: appBarTitle ?? this.appBarTitle,
      sendButton: sendButton ?? this.sendButton,
      inputPlaceHolder: inputPlaceHolder ?? this.inputPlaceHolder,
      addFromGalleryButton: addFromGalleryButton ?? this.addFromGalleryButton,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BugReportText &&
          runtimeType == other.runtimeType &&
          appBarTitle == other.appBarTitle &&
          sendButton == other.sendButton &&
          inputPlaceHolder == other.inputPlaceHolder &&
          addFromGalleryButton == other.addFromGalleryButton;

  @override
  int get hashCode => Object.hash(
        appBarTitle,
        sendButton,
        inputPlaceHolder,
        addFromGalleryButton,
      );
}

/// Color configuration for customizing the bug report UI appearance.
/// 
/// [BugReportColors] allows you to customize the colors used in the
/// bug report widget to match your app's brand and design system.
/// 
/// **Example:**
/// ```dart
/// final customColors = BugReportColors(
///   primaryColor: Colors.blue,
/// );
/// ```
@immutable
class BugReportColors {
  final Color? primaryColor;

  const BugReportColors({
    this.primaryColor,
  });

  BugReportColors copyWith({
    Color? primaryColor,
  }) {
    return BugReportColors(
      primaryColor: primaryColor ?? this.primaryColor,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BugReportColors &&
          runtimeType == other.runtimeType &&
          primaryColor == other.primaryColor;

  @override
  int get hashCode => primaryColor.hashCode;
}

/// Complete theme configuration for the bug report UI.
/// 
/// [BugReportTheme] combines text and color customizations to provide
/// a complete theming solution for the bug report widget.
/// 
/// **Example:**
/// ```dart
/// final customTheme = BugReportTheme(
///   text: BugReportText(
///     appBarTitle: 'Report Issue',
///     sendButton: 'Submit Report',
///   ),
///   colors: BugReportColors(
///     primaryColor: Theme.of(context).primaryColor,
///   ),
/// );
/// 
/// // Use in bug report widget
/// showDialog(
///   context: context,
///   builder: (context) => Measure.instance.createBugReportWidget(
///     theme: customTheme,
///   ),
/// );
/// ```
@immutable
class BugReportTheme {
  final BugReportText text;
  final BugReportColors colors;

  const BugReportTheme({
    this.text = const BugReportText(),
    this.colors = const BugReportColors(),
  });

  BugReportTheme copyWith({
    BugReportText? text,
    BugReportColors? colors,
  }) {
    return BugReportTheme(
      text: text ?? this.text,
      colors: colors ?? this.colors,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BugReportTheme &&
          runtimeType == other.runtimeType &&
          text == other.text &&
          colors == other.colors;

  @override
  int get hashCode => Object.hash(text, colors);
}