//
//  HttpEventValidator.swift
//  Measure
//
//  Created by Adwin Ross on 27/03/25.
//

import Foundation

protocol HttpEventValidator {
    func shouldTrackHttpEvent(_ httpContentTypeAllowlist: [String]?, contentType: String, requestUrl: String, allowedDomains: [String]?, ignoredDomains: [String]?) -> Bool
}

final class BaseHttpEventValidator: HttpEventValidator {
    func shouldTrackHttpEvent(_ httpContentTypeAllowlist: [String]?, contentType: String, requestUrl: String, allowedDomains: [String]?, ignoredDomains: [String]?) -> Bool {
        // Skip if content type is not in httpContentTypeAllowlist
        if let httpContentTypeAllowlist = httpContentTypeAllowlist, !httpContentTypeAllowlist.contains(where: { contentType.contains($0) }) {
            return false
        }

        // Skip if allowedDomains is non-empty and the URL doesn't match any domain in allowedDomains
        if let allowedDomains = allowedDomains.flatMap({ $0 }), !allowedDomains.isEmpty && !allowedDomains.contains(where: { requestUrl.contains($0) }) {
            return false
        }
        // Skip if the URL is in ignored domains, only if allowedDomains is empty
        else if let ignoreDomains = ignoredDomains.flatMap({ $0 }), ignoreDomains.contains(where: { requestUrl.contains($0) }) {
            return false
        }

        return true
    }
}
