//
//  ComputeOnceAttributeProcessor.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 03/09/24.
//

import Foundation

protocol ComputeOnceAttributeProcessor {
    func computeAttributes()
    func updateAttribute(_ attribute: Attributes)
}

/// Generates the attributes once and then caches them. Subsequent calls to [appendAttributes] will return the cached attributes.
/// This is useful for attributes that are expensive to compute and are not expected to change.
///
/// Implementations should override [computeAttributes, updateAttribute] to compute the attributes and do not need to override [appendAttributes].
///
class BaseComputeOnceAttributeProcessor: AttributeProcessor, ComputeOnceAttributeProcessor {
    private var isComputed = false

    func appendAttributes(_ attribute: Attributes) {
        if !isComputed {
            computeAttributes()
            isComputed = true
        }
        updateAttribute(attribute)
    }

    func updateAttribute(_ attribute: Attributes) {
        fatalError("Subclasses must override updateAttribute()")
    }

    func computeAttributes() {
        fatalError("Subclasses must override computeAttributes()")
    }
}
