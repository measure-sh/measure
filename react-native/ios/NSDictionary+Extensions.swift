import Foundation

extension NSDictionary {
    func decoded<T: Decodable>(as type: T.Type) -> T? {
        guard let data = try? JSONSerialization.data(withJSONObject: self, options: []) else {
            return nil
        }
        
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            print("Decoding error: \(error)")
            return nil
        }
    }
}
