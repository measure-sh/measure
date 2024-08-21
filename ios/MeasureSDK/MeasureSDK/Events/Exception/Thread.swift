//
//  Thread.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 20/08/24.
//

import Foundation

struct Thread: Codable {
    
    /// The name of the thread.
    let name: String
    
    /// An array of `StackFrame` objects representing the stack frames in the thread.
    let frames: [StackFrame]
    
    /// The sequence number of the thread
    let sequence: Int
    
    enum CodingKeys: String, CodingKey {
        case name
        case frames
        case sequence
    }
    
    init(name: String, 
         frames: [StackFrame],
         sequence: Int) {
        self.name = name
        self.frames = frames
        self.sequence = sequence
    }
    
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        name = try values.decode(String.self, forKey: .name)
        frames = try values.decode([StackFrame].self, forKey: .frames)
        sequence = try values.decode(Int.self, forKey: .sequence)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(name, forKey: .name)
        try container.encode(frames, forKey: .frames)
        try container.encode(sequence, forKey: .sequence)
    }
}
