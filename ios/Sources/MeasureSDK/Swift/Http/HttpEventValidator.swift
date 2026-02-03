//
//  HttpEventValidator.swift
//  Measure
//
//  Created by Adwin Ross on 27/03/25.
//

import Foundation

protocol HttpEventValidator {
    func shouldTrackHttpEvent(_ httpContentTypeAllowlist: [String]?, contentType: String, requestUrl: String, allowedDomains: [String]?, ignoredDomains: [String]?) -> Bool
    func validateAndTrimBody(_ body: String?, maxBodySizeBytes: Number) -> String?
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

    func validateAndTrimBody(_ body: String?, maxBodySizeBytes: Number) -> String? {
        guard let body = body, !body.isEmpty else {
            return nil
        }

        guard let data = body.data(using: .utf8) else {
            return nil
        }

        guard data.count > maxBodySizeBytes else {
            return body
        }

        let trimmedData = data.prefix(Int(maxBodySizeBytes))

        var trimmedString: String? = String(data: trimmedData, encoding: .utf8)
        if trimmedString == nil {
            for i in (0..<min(4, trimmedData.count)).reversed() {
                let validData = trimmedData.prefix(trimmedData.count - i)
                if let str = String(data: validData, encoding: .utf8) {
                    trimmedString = str
                    break
                }
            }
        }

        guard var result = trimmedString else {
            return nil
        }

        let truncationNotice = "\n... [Body truncated - exceeded 256KB limit]"
        result.append(truncationNotice)

        return result
    }
}
