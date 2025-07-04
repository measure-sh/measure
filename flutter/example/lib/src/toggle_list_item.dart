import 'package:flutter/material.dart';

class ToggleListItem extends StatefulWidget {
  final String title;
  final bool initialValue;
  final Function(bool) onChanged;

  const ToggleListItem({
    super.key,
    required this.title,
    required this.onChanged,
    this.initialValue = false,
  });

  @override
  State<ToggleListItem> createState() => _ToggleListItemState();
}

class _ToggleListItemState extends State<ToggleListItem> {
  late bool _isToggled;

  @override
  void initState() {
    super.initState();
    _isToggled = widget.initialValue;
  }

  void _handleToggle(bool value) {
    setState(() {
      _isToggled = value;
    });
    widget.onChanged(value);
  }

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(widget.title),
      trailing: Switch(
        value: _isToggled,
        onChanged: _handleToggle,
      ),
      onTap: () => _handleToggle(!_isToggled),
    );
  }
}