//
//  String+Extension.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 12/12/24.
//

import Foundation

extension String {
    func removeHttpPrefix() -> String {
        return self.replacingOccurrences(of: "https://", with: "")
                   .replacingOccurrences(of: "http://", with: "")
    }

    func sanitizeRequestBody() -> String {
        return self.replacingOccurrences(of: "\r", with: "")
                   .replacingOccurrences(of: "\n", with: "")
                   .replacingOccurrences(of: "\t", with: "")
                   .replacingOccurrences(of: " ", with: "")
                   .replacingOccurrences(of: "{", with: "")
                   .replacingOccurrences(of: "}", with: "")
                   .replacingOccurrences(of: "\"", with: "")
    }
}
