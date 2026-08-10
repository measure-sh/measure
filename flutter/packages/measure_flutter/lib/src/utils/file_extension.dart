/// Returns the file extension of [pathOrName] without the leading dot, or an
/// empty string when there is none.
String fileExtensionOf(String pathOrName) {
  final separator = pathOrName.lastIndexOf(RegExp(r'[/\\]'));
  final basename =
      separator == -1 ? pathOrName : pathOrName.substring(separator + 1);

  final dot = basename.lastIndexOf('.');
  if (dot <= 0 || dot == basename.length - 1) {
    return '';
  }

  return basename.substring(dot + 1);
}
