import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

/// Returns an un-obfuscated name for the given widget
/// type, null if no match is found.
String? getFrameworkWidgetName(Widget widget) {
  final type = switch (widget) {
    FilledButton _ => 'FilledButton',
    OutlinedButton _ => 'OutlinedButton',
    TextButton _ => 'TextButton',
    ElevatedButton _ => 'ElevatedButton',
    CupertinoButton _ => 'CupertinoButton',
    ButtonStyleButton _ => 'ButtonStyleButton',
    MaterialButton _ => 'MaterialButton',
    IconButton _ => 'IconButton',
    FloatingActionButton _ => 'FloatingActionButton',
    ListTile _ => 'ListTile',
    PopupMenuButton _ => 'PopupMenuButton',
    PopupMenuItem _ => 'PopupMenuItem',
    DropdownButton w when w.onChanged != null => 'DropdownButton',
    DropdownMenuItem _ => 'DropdownMenuItem',
    ExpansionTile _ => 'ExpansionTile',
    Card _ => 'Card',
    Scaffold _ => 'Scaffold',
    CupertinoPageScaffold _ => 'CupertinoPageScaffold',
    MaterialApp _ => 'MaterialApp',
    CupertinoApp _ => 'CupertinoApp',
    Container _ => 'Container',
    Row _ => 'Row',
    Column _ => 'Column',
    ListView _ => 'ListView',
    PageView _ => 'PageView',
    SingleChildScrollView _ => 'SingleChildScrollView',
    ScrollView _ => 'ScrollView',
    Text _ => 'Text',
    RichText _ => 'RichText',
    _ => null,
  };
  return type;
}

/// Returns an un-obfuscated name for the given widget
/// type, null if no match is found.
String? getClickableWidgetName(Widget widget) {
  return switch (widget) {
    FilledButton w when w.enabled => 'FilledButton',
    OutlinedButton w when w.enabled => 'OutlinedButton',
    CupertinoButton w when w.enabled => 'CupertinoButton',
    TextButton w when w.enabled => 'TextButton',
    ElevatedButton w when w.enabled => 'ElevatedButton',
    ButtonStyleButton w when w.enabled => 'ButtonStyleButton',
    MaterialButton w when w.enabled => 'MaterialButton',
    IconButton w when w.onPressed != null => 'IconButton',
    FloatingActionButton w when w.onPressed != null => 'FloatingActionButton',
    CupertinoButton w when w.enabled => 'CupertinoButton',
    ListTile _ => 'ListTile',
    PopupMenuButton w when w.enabled => 'PopupMenuButton',
    PopupMenuItem w when w.enabled => 'PopupMenuItem',
    DropdownButton w when w.onChanged != null => 'DropdownButton',
    DropdownMenuItem _ => 'DropdownMenuItem',
    ExpansionTile _ => 'ExpansionTile',
    Card _ => 'Card',
    InkWell w when w.onTap != null => 'InkWell',
    GestureDetector w when w.onTap != null || w.onDoubleTap != null || w.onLongPress != null => 'GestureDetector',
    InkResponse w when w.onTap != null => 'InkResponse',
    InputChip w when w.onPressed != null => 'InputChip',
    ActionChip w when w.onPressed != null => 'ActionChip',
    FilterChip w when w.onSelected != null => 'FilterChip',
    ChoiceChip w when w.onSelected != null => 'ChoiceChip',
    Checkbox w when w.onChanged != null => 'Checkbox',
    Switch w when w.onChanged != null => 'Switch',
    Radio _ => 'Radio',
    CupertinoSwitch w when w.onChanged != null => 'CupertinoSwitch',
    CheckboxListTile w when w.onChanged != null => 'CheckboxListTile',
    SwitchListTile w when w.onChanged != null => 'SwitchListTile',
    RadioListTile _ => 'RadioListTile',
    Slider w when w.onChanged != null => 'Slider',
    RangeSlider w when w.onChanged != null => 'RangeSlider',
    CupertinoSlider w when w.onChanged != null => 'CupertinoSlider',
    TextField _ => 'TextField',
    TextFormField _ => 'TextFormField',
    CupertinoTextField _ => 'CupertinoTextField',
    Stepper _ => 'Stepper',
    _ => null,
  };
}

/// Returns an un-obfuscated name for the given widget
/// type, null if no match is found.
String? getScrollableWidgetName(Widget widget) {
  return switch (widget) {
    ListView _ => 'ListView',
    PageView _ => 'PageView',
    SingleChildScrollView _ => 'SingleChildScrollView',
    ScrollView _ => 'ScrollView',
    _ => null,
  };
}

/// Returns the element type for the given widget based on its semantic purpose.
/// Returns "container" as the default if no specific match is found.
String getWidgetElementType(Widget widget) {
  return switch (widget) {
    // Button types
    FilledButton _ => 'button',
    OutlinedButton _ => 'button',
    TextButton _ => 'button',
    ElevatedButton _ => 'button',
    CupertinoButton _ => 'button',
    ButtonStyleButton _ => 'button',
    MaterialButton _ => 'button',
    IconButton _ => 'button',
    FloatingActionButton _ => 'button',
    PopupMenuButton _ => 'button',
    PopupMenuItem _ => 'button',
    ExpansionTile _ => 'button',
    InkWell _ => 'button',
    GestureDetector _ => 'button',
    InkResponse _ => 'button',
    InputChip _ => 'button',
    ActionChip _ => 'button',
    FilterChip _ => 'button',
    ChoiceChip _ => 'button',

    // Text types
    Text _ => 'text',
    RichText _ => 'text',

    // Input types
    TextField _ => 'input',
    TextFormField _ => 'input',
    CupertinoTextField _ => 'input',

    // Checkbox types
    Checkbox _ => 'checkbox',
    CheckboxListTile _ => 'checkbox',
    Switch _ => 'checkbox',
    CupertinoSwitch _ => 'checkbox',
    SwitchListTile _ => 'checkbox',

    // Radio types
    Radio _ => 'radio',
    RadioListTile _ => 'radio',

    // Dropdown types
    DropdownButton _ => 'dropdown',
    DropdownMenuItem _ => 'dropdown',

    // Slider types
    Slider _ => 'slider',
    RangeSlider _ => 'slider',
    CupertinoSlider _ => 'slider',

    // List types
    ListView _ => 'list',
    ListTile _ => 'list',

    // Default to container for unknown types
    _ => 'container',
  };
}
