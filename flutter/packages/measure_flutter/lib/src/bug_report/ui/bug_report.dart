import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:measure_flutter/measure.dart';

/// Main bug report screen that allows users to describe issues and
/// attach screenshots.
class BugReport extends StatefulWidget {
  final MsrAttachment? screenshot;
  final Map<String, AttributeValue>? attributes;

  const BugReport({
    super.key,
    this.screenshot,
    this.attributes,
  });

  @override
  State<StatefulWidget> createState() {
    return _BugReport();
  }
}

class _BugReport extends State<BugReport> {
  late List<MsrAttachment> screenshots;
  final ImagePicker _picker = ImagePicker();
  late TextEditingController _textController;
  static const int maxScreenshots = 5;

  @override
  void initState() {
    super.initState();
    final screenshot = widget.screenshot;
    screenshots = screenshot != null ? [screenshot] : [];
    _textController = TextEditingController();
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  Future<void> _pickImageFromGallery() async {
    // Check if maximum screenshots already exist
    if (screenshots.length >= maxScreenshots) {
      if (mounted) {
        _showSnackBar('Maximum $maxScreenshots screenshots allowed');
      }
      return;
    }

    try {
      // Calculate how many more images can be selected
      final remainingSlots = maxScreenshots - screenshots.length;
      final List<XFile> images = await _picker.pickMultiImage(
        imageQuality: 20,
        limit: remainingSlots,
      );

      if (images.isNotEmpty) {
        List<MsrAttachment> newAttachments = [];

        // Take only the first 'remainingSlots' images (in case more are returned)
        final imagesToProcess = images.take(remainingSlots).toList();

        for (XFile image in imagesToProcess) {
          final bytes = await image.readAsBytes();
          final attachment = Measure.instance.createAttachment(
            bytes,
            AttachmentType.screenshot,
          );
          if (attachment != null) {
            newAttachments.add(attachment);
          }
        }

        setState(() {
          screenshots.addAll(newAttachments);
        });
      }
    } catch (e) {
      if (mounted) {
        _showSnackBar('Failed to pick images: $e');
      }
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(milliseconds: 1000),
      ),
    );
  }

  void _onDeleteScreenshot(MsrAttachment attachment) {
    setState(() {
      screenshots.remove(attachment);
    });
  }

  void _sendBugReport() {
    Measure.instance.trackBugReport(
      description: _textController.text,
      attachments: screenshots,
      attributes: widget.attributes ?? {},
    );
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: BugReportAppBar(onSend: _sendBugReport),
      body: SafeArea(
        child: BugReportBody(
          textController: _textController,
          screenshots: screenshots,
          onDeleteScreenshot: _onDeleteScreenshot,
          onPickImage: _pickImageFromGallery,
        ),
      ),
    );
  }
}

/// Custom app bar for the bug report screen.
class BugReportAppBar extends StatelessWidget implements PreferredSizeWidget {
  final VoidCallback onSend;

  const BugReportAppBar({
    super.key,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: const Text(
        "Report a Bug",
        style: TextStyle(fontWeight: FontWeight.w600),
      ),
      centerTitle: true,
      actions: [
        SendButton(onPressed: onSend),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

/// Send button widget for submitting bug reports.
class SendButton extends StatelessWidget {
  final VoidCallback onPressed;

  const SendButton({
    super.key,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      child: const Text(
        "Send",
        style: TextStyle(fontWeight: FontWeight.w600),
      ),
    );
  }
}

/// Main body layout for the bug report screen.
class BugReportBody extends StatelessWidget {
  final TextEditingController textController;
  final List<MsrAttachment> screenshots;
  final Function(MsrAttachment) onDeleteScreenshot;
  final VoidCallback onPickImage;

  const BugReportBody({
    super.key,
    required this.textController,
    required this.screenshots,
    required this.onDeleteScreenshot,
    required this.onPickImage,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final shouldHideBottom = constraints.maxHeight < 240;
      final maxBottomHeight = constraints.maxHeight * 0.3;
      return Column(
        children: [
          Expanded(
            child: BugReportInput(controller: textController),
          ),
          if (!shouldHideBottom)
            ConstrainedBox(
              constraints: BoxConstraints(maxHeight: maxBottomHeight),
              child: ScreenshotList(
                screenshots: screenshots,
                onDeleteScreenshot: onDeleteScreenshot,
              ),
            ),
          if (!shouldHideBottom) AddImageButton(onPressed: onPickImage),
        ],
      );
    });
  }
}

/// Button for adding images from the device gallery.
class AddImageButton extends StatelessWidget {
  final VoidCallback onPressed;

  const AddImageButton({
    super.key,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: OutlinedButton(
          onPressed: onPressed,
          child: const AddImageButtonContent(),
        ),
      ),
    );
  }
}

/// Content layout for the add image button.
class AddImageButtonContent extends StatelessWidget {
  const AddImageButtonContent({super.key});

  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisSize: MainAxisSize.max,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.photo),
        SizedBox(width: 8),
        Text("Add from Gallery"),
      ],
    );
  }
}

/// Text input widget for bug report descriptions.
class BugReportInput extends StatefulWidget {
  final TextEditingController? controller;

  const BugReportInput({
    super.key,
    this.controller,
  });

  @override
  State<StatefulWidget> createState() {
    return _BugReportInput();
  }
}

class _BugReportInput extends State<BugReportInput> {
  late TextEditingController textController;
  final FocusNode focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    textController = widget.controller ?? TextEditingController();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      child: BugDescriptionTextField(
        controller: textController,
        focusNode: focusNode,
      ),
    );
  }

  @override
  void dispose() {
    if (widget.controller == null) {
      textController.dispose();
    }
    focusNode.dispose();
    super.dispose();
  }
}

/// Multi-line text field for entering bug descriptions.
class BugDescriptionTextField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;

  const BugDescriptionTextField({
    super.key,
    required this.controller,
    required this.focusNode,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      focusNode: focusNode,
      maxLines: null,
      expands: true,
      textAlignVertical: TextAlignVertical.top,
      decoration: const InputDecoration(
        hintText: 'Briefly describe the issue you are facing',
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        contentPadding: EdgeInsets.all(0),
      ),
      style: const TextStyle(
        fontSize: 16,
        height: 1.4,
      ),
    );
  }
}

/// Horizontal scrollable list of screenshot thumbnails.
class ScreenshotList extends StatefulWidget {
  final List<MsrAttachment> screenshots;
  final Function(MsrAttachment)? onDeleteScreenshot;

  const ScreenshotList({
    super.key,
    this.screenshots = const [],
    this.onDeleteScreenshot,
  });

  @override
  State<StatefulWidget> createState() {
    return _ScreenshotList();
  }
}

class _ScreenshotList extends State<ScreenshotList> {
  final GlobalKey<AnimatedListState> _listKey = GlobalKey<AnimatedListState>();
  final ScrollController _scrollController = ScrollController();
  late List<MsrAttachment> _screenshots;

  @override
  void initState() {
    super.initState();
    _screenshots = List.from(widget.screenshots);
  }

  @override
  void didUpdateWidget(ScreenshotList oldWidget) {
    super.didUpdateWidget(oldWidget);
    _handleScreenshotListUpdates();
  }

  void _handleScreenshotListUpdates() {
    _handleRemovals();
    _handleAdditions();
  }

  void _handleRemovals() {
    for (int i = _screenshots.length - 1; i >= 0; i--) {
      if (!widget.screenshots.contains(_screenshots[i])) {
        final removedItem = _screenshots.removeAt(i);
        _listKey.currentState?.removeItem(
          i,
          (context, animation) => _buildAnimatedItem(removedItem, animation),
          duration: const Duration(milliseconds: 300),
        );
      }
    }
  }

  void _handleAdditions() {
    for (int i = 0; i < widget.screenshots.length; i++) {
      final newItem = widget.screenshots[i];
      if (!_screenshots.contains(newItem)) {
        _screenshots.insert(i, newItem);
        _listKey.currentState
            ?.insertItem(i, duration: const Duration(milliseconds: 300));
        _scrollToEnd();
      }
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Widget _buildAnimatedItem(
      MsrAttachment attachment, Animation<double> animation) {
    return AnimatedScreenshotItem(
      attachment: attachment,
      animation: animation,
      onDelete: widget.onDeleteScreenshot != null
          ? () => widget.onDeleteScreenshot!(attachment)
          : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedList(
      key: _listKey,
      controller: _scrollController,
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.only(left: 12, right: 12),
      initialItemCount: _screenshots.length,
      itemBuilder: (context, index, animation) {
        if (index >= _screenshots.length) return const SizedBox.shrink();
        return _buildAnimatedItem(_screenshots[index], animation);
      },
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }
}

/// Individual animated screenshot item in the list.
class AnimatedScreenshotItem extends StatelessWidget {
  final MsrAttachment attachment;
  final Animation<double> animation;
  final VoidCallback? onDelete;

  const AnimatedScreenshotItem({
    super.key,
    required this.attachment,
    required this.animation,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: animation.drive(
        Tween<double>(begin: 0.0, end: 1.0).chain(
          CurveTween(curve: Curves.easeOut),
        ),
      ),
      child: FadeTransition(
        opacity: animation,
        child: Thumbnail(
          attachment: attachment,
          onDelete: onDelete,
        ),
      ),
    );
  }
}

/// Thumbnail display widget for screenshot images.
class Thumbnail extends StatefulWidget {
  final MsrAttachment attachment;
  final VoidCallback? onDelete;

  const Thumbnail({
    super.key,
    required this.attachment,
    this.onDelete,
  });

  @override
  State<StatefulWidget> createState() {
    return _Thumbnail();
  }
}

class _Thumbnail extends State<Thumbnail> {
  bool _isLoading = true;

  @override
  Widget build(BuildContext context) {
    final bytes = widget.attachment.bytes;

    if (bytes == null) {
      return const SizedBox.shrink();
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 100),
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Container(
              decoration: _isLoading
                  ? null
                  : BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.grey.shade400),
                    ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: ThumbnailImage(
                  bytes: bytes,
                  onImageLoaded: () {
                    if (mounted && _isLoading) {
                      setState(() => _isLoading = false);
                    }
                  },
                ),
              ),
            ),
          ),
          if (widget.onDelete != null && !_isLoading)
            Positioned(
              top: 0,
              right: 0,
              child: DeleteButton(onDelete: widget.onDelete!),
            ),
        ],
      ),
    );
  }
}

/// Image display widget for screenshot thumbnails.
class ThumbnailImage extends StatelessWidget {
  final Uint8List bytes;
  final VoidCallback onImageLoaded;

  const ThumbnailImage({
    super.key,
    required this.bytes,
    required this.onImageLoaded,
  });

  @override
  Widget build(BuildContext context) {
    return Image.memory(
      bytes,
      fit: BoxFit.contain,
      frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
        if (wasSynchronouslyLoaded || frame != null) {
          WidgetsBinding.instance.addPostFrameCallback((_) => onImageLoaded());
          return child;
        }
        return const SizedBox.shrink();
      },
    );
  }
}

/// Interactive delete button for removing screenshot thumbnails.
class DeleteButton extends StatefulWidget {
  final VoidCallback onDelete;

  const DeleteButton({
    super.key,
    required this.onDelete,
  });

  @override
  State<DeleteButton> createState() => _DeleteButtonState();
}

class _DeleteButtonState extends State<DeleteButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topRight,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: GestureDetector(
          onTapDown: (_) => setState(() => _isPressed = true),
          onTapUp: (_) => setState(() => _isPressed = false),
          onTapCancel: () => setState(() => _isPressed = false),
          onTap: widget.onDelete,
          child: AnimatedScale(
            scale: _isPressed ? 0.9 : 1.0,
            duration: const Duration(milliseconds: 100),
            child: DeleteButtonIcon(),
          ),
        ),
      ),
    );
  }
}

class DeleteButtonIcon extends StatelessWidget {
  const DeleteButtonIcon({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.grey.shade900,
        shape: BoxShape.circle,
      ),
      padding: const EdgeInsets.all(4),
      child: const Icon(
        Icons.close,
        size: 20,
        color: Colors.white,
      ),
    );
  }
}
