//
//  MethodArgumentError.swift
//  measure_flutter
//
//  Created by Abhay Sood on 12/02/25.
//

import Foundation

class MethodArgumentError: Error {
    let code: String
    let message: String
    let details: String

    init(code: String, message: String, details: String) {
        self.code = code
        self.message = message
        self.details = details
    }
}
