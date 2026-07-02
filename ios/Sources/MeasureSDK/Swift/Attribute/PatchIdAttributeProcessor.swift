import Foundation

/// Maintains the state for the patch_id and patch_version attributes. Both are set once at SDK
/// initialization and identify the current OTA patch for sourcemap symbolication.
final class PatchIdAttributeProcessor: AttributeProcessor {
    private var patchId: String?
    private var patchVersion: String?

    func appendAttributes(_ attributes: Attributes) {
        attributes.patchId = patchId
        attributes.patchVersion = patchVersion
    }

    func setPatchId(_ patchId: String) {
        self.patchId = patchId
    }

    func setPatchVersion(_ patchVersion: String) {
        self.patchVersion = patchVersion
    }
}
