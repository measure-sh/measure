//
//  PatchAttributeProcessor.swift
//  MeasureSDK
//

import Foundation

/// Maintains the state for the patch ID and patch version attributes. These are set once by the
/// React Native SDK when it initializes and are attached to every event and span generated after
/// that point, including native events. The values are held in memory only and are not persisted
/// across app launches.
final class PatchAttributeProcessor: AttributeProcessor {
    private var patchId: String?
    private var patchVersion: String?

    func appendAttributes(_ attributes: Attributes) {
        attributes.patchId = patchId
        attributes.patchVersion = patchVersion
    }

    func setPatch(_ patchId: String, patchVersion: String?) {
        self.patchId = patchId
        self.patchVersion = patchVersion
    }
}
