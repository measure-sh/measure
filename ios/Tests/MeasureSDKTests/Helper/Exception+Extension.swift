//
//  Exception+Extension.swift
//  MeasureSDKTests
//
//  Created by Adwin Ross on 21/09/24.
//

import Foundation
@testable import Measure

extension Exception: Equatable {
    public static func == (lhs: Exception, rhs: Exception) -> Bool {
        guard lhs.handled == rhs.handled else { return false }

        guard lhs.exceptions.count == rhs.exceptions.count else { return false }
        for (lhsException, rhsException) in zip(lhs.exceptions, rhs.exceptions) {
            guard lhsException == rhsException else { return false }
        }

        guard lhs.foreground == rhs.foreground else { return false }

        guard (lhs.threads?.count ?? 0) == (rhs.threads?.count ?? 0) else { return false }
        for (lhsThread, rhsThread) in zip(lhs.threads ?? [], rhs.threads ?? []) {
            guard lhsThread == rhsThread else { return false }
        }

        return true
    }
}

extension ExceptionDetail: Equatable {
    public static func == (lhs: ExceptionDetail, rhs: ExceptionDetail) -> Bool {
        guard lhs.type == rhs.type,
              lhs.message == rhs.message,
              lhs.signal == rhs.signal,
              lhs.threadName == rhs.threadName,
              lhs.threadSequence == rhs.threadSequence,
              lhs.osBuildNumber == rhs.osBuildNumber else {
            return false
        }
        guard (lhs.frames?.count ?? 0) == (rhs.frames?.count ?? 0) else {
            return false
        }

        for (lhsFrame, rhsFrame) in zip(lhs.frames ?? [], rhs.frames ?? []) {
            guard lhsFrame == rhsFrame else { return false }
        }

        return true
    }
}

extension ThreadDetail: Equatable {
    public static func == (lhs: ThreadDetail, rhs: ThreadDetail) -> Bool {
        guard lhs.name == rhs.name,
              lhs.sequence == rhs.sequence else {
            return false
        }

        guard lhs.frames.count == rhs.frames.count else {
            return false
        }

        for (lhsFrame, rhsFrame) in zip(lhs.frames, rhs.frames) {
            guard lhsFrame == rhsFrame else { return false }
        }

        return true
    }
}

extension StackFrame: Equatable {
    public static func == (lhs: StackFrame, rhs: StackFrame) -> Bool {
        return lhs.binaryName == rhs.binaryName &&
               lhs.binaryAddress == rhs.binaryAddress &&
               lhs.offset == rhs.offset &&
               lhs.frameIndex == rhs.frameIndex &&
               lhs.symbolAddress == rhs.symbolAddress &&
               lhs.inApp == rhs.inApp
    }
}
