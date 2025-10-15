//
//  MockAttachmentExporter.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 13/10/25.
//

import Foundation
@testable import Measure

final class MockAttachmentExporter: AttachmentExporter {
    var isEnabled: Bool = false
    var onNewAttachmentsAvailableCalled: Bool = false

    func enable() {
        isEnabled = true
    }

    func disable() {
        isEnabled = false
    }

    func onNewAttachmentsAvailable() {
        onNewAttachmentsAvailableCalled = true
    }
}
