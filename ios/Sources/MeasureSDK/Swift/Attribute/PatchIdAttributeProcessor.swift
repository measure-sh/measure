import Foundation

/// Maintains the state for the patch_id attribute. The patch ID is set once at SDK initialization
/// and identifies the current OTA patch for sourcemap symbolication.
final class PatchIdAttributeProcessor: AttributeProcessor {
    private var patchId: String?

    func appendAttributes(_ attributes: Attributes) {
        attributes.patchId = patchId
    }

    func setPatchId(_ patchId: String) {
        self.patchId = patchId
    }
}
