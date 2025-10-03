import Foundation
import Measure

extension NSDictionary {
    func decoded<T: Decodable>(as type: T.Type) -> T? {
        guard let data = try? JSONSerialization.data(withJSONObject: self, options: []) else {
            return nil
        }
        
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            print("Decoding error: \(error)") // TODO: Make log more descriptive
            return nil
        }
    }

    func transformAttributes() -> [String: AttributeValue] {
        guard let attributes = self as? [String: Any] else {
            return [:]
        }

        var transformedAttributes: [String: AttributeValue] = [:]

        for (key, value) in attributes {
            if let stringVal = value as? String {
                transformedAttributes[key] = .string(stringVal)
            } else if let boolVal = value as? Bool {
                transformedAttributes[key] = .boolean(boolVal)
            } else if let intVal = value as? Int {
                transformedAttributes[key] = .int(intVal)
            } else if let longVal = value as? Int64 {
                transformedAttributes[key] = .long(longVal)
            } else if let floatVal = value as? Float {
                transformedAttributes[key] = .float(floatVal)
            } else if let doubleVal = value as? Double {
                transformedAttributes[key] = .double(doubleVal)
            }
        }

        return transformedAttributes
    }
}
