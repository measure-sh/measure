import Foundation

enum CredentialOverrides {
    private static let apiUrlKey = "measure_credential_overrides.api_url"
    private static let apiKeyKey = "measure_credential_overrides.api_key"

    static let apiKeyPrefix = "msrsh"

    struct Credentials: Equatable {
        let apiUrl: String
        let apiKey: String
    }

    static func bundleCredentials() -> Credentials {
        Credentials(
            apiUrl: Bundle.main.object(forInfoDictionaryKey: "MeasureApiUrl") as? String ?? "",
            apiKey: Bundle.main.object(forInfoDictionaryKey: "MeasureApiKey") as? String ?? ""
        )
    }

    static func savedCredentials() -> Credentials? {
        let defaults = UserDefaults.standard
        guard let apiUrl = defaults.string(forKey: apiUrlKey),
              let apiKey = defaults.string(forKey: apiKeyKey),
              !apiUrl.isEmpty, !apiKey.isEmpty else {
            return nil
        }
        return Credentials(apiUrl: apiUrl, apiKey: apiKey)
    }

    static func effectiveCredentials() -> Credentials {
        savedCredentials() ?? bundleCredentials()
    }

    static func save(_ credentials: Credentials) {
        let defaults = UserDefaults.standard
        defaults.set(credentials.apiUrl, forKey: apiUrlKey)
        defaults.set(credentials.apiKey, forKey: apiKeyKey)
    }

    static func clear() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: apiUrlKey)
        defaults.removeObject(forKey: apiKeyKey)
    }

    static func validationError(forApiUrl apiUrl: String) -> String? {
        if apiUrl.isEmpty {
            return "API URL cannot be empty"
        }
        guard let url = URL(string: apiUrl), url.scheme != nil, url.host != nil else {
            return "API URL is not a valid URL"
        }
        return nil
    }

    static func validationError(forApiKey apiKey: String) -> String? {
        guard apiKey.hasPrefix(apiKeyPrefix) else {
            return "API key must start with \"\(apiKeyPrefix)\""
        }
        return nil
    }
}
