//
//  String+Extension.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 12/12/24.
//

import Foundation

extension String {
    func sanitizeRequestBody() -> String {
        return self.replacingOccurrences(of: "\r", with: "")
                   .replacingOccurrences(of: "\n", with: "")
                   .replacingOccurrences(of: "\t", with: "")
                   .replacingOccurrences(of: " ", with: "")
                   .replacingOccurrences(of: "{", with: "")
                   .replacingOccurrences(of: "}", with: "")
                   .replacingOccurrences(of: "\"", with: "")
    }

    func truncated(maxLength: Int) -> String {
        guard maxLength > 0 else { return "" }
        guard count > maxLength else { return self }
        return String(prefix(maxLength))
    }
}
