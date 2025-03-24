//
//  Attachment+Extension.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 26/09/24.
//

import Foundation
@testable import Measure

extension Attachment: Equatable {
    public static func == (lhs: Attachment, rhs: Attachment) -> Bool {
        return lhs.name == rhs.name &&
               lhs.path == rhs.path &&
               lhs.type == rhs.type &&
               lhs.bytes == rhs.bytes
    }
}
