//
//  CGFloat+Extension.swift
//  Measure
//
//  Created by Adwin Ross on 29/04/25.
//

import Foundation

extension CGFloat {
    var safeInt: Int {
        if !self.isFinite {
            return 0
        }
        if self > CGFloat(Int.max) {
            return Int.max
        }
        if self < CGFloat(Int.min) {
            return Int.min
        }
        return Int(self)
    }
}
