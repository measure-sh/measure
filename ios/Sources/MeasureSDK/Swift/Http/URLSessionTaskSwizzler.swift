//
//  URLSessionTaskSwizzler.swift
//  MeasureSDK
//
//  Created by Adwin Ross on 28/11/24.
//

import Foundation

final class URLSessionTaskSwizzler {
    func swizzleURLSessionTask() {
        let classesToSwizzle = URLSessionTaskSearch.urlSessionTaskClasses()
        guard !classesToSwizzle.isEmpty else { return }

        let setStateSelector = NSSelectorFromString("setState:")

        for classToSwizzle in classesToSwizzle {
            // Swizzle the setState: method
            swizzle(
                classToSwizzle,
                originalSelector: setStateSelector,
                swizzledSelector: #selector(URLSessionTask.setStateSwizzled(state:))
            )
        }
    }

    private func swizzle(_ cls: AnyClass, originalSelector: Selector, swizzledSelector: Selector) {
        guard let originalMethod = class_getInstanceMethod(cls, originalSelector),
              let swizzledMethod = class_getInstanceMethod(cls, swizzledSelector) else {
            return
        }

        let didAddMethod = class_addMethod(
            cls,
            originalSelector,
            method_getImplementation(swizzledMethod),
            method_getTypeEncoding(swizzledMethod)
        )

        if didAddMethod {
            class_replaceMethod(
                cls,
                swizzledSelector,
                method_getImplementation(originalMethod),
                method_getTypeEncoding(originalMethod)
            )
        } else {
            method_exchangeImplementations(originalMethod, swizzledMethod)
        }
    }
}

private class URLSessionTaskSearch {
    /// To track network requests, we swizzle the `setState:` method of NSURLSessionTask task.
    /// The below code helps us identify which subclass of NSURLSessionTask implements the setState: function so that it can be swizzled.
    ///
    /// This inspiration for this code was taken from https://github.com/AFNetworking/AFNetworking/blob/4eaec5b586ddd897ebeda896e332a62a9fdab818/AFNetworking/AFURLSessionManager.m#L382-L403
    /// - Returns: Classes that implement NSURLSessionTask's `setState:` function
    fileprivate static func urlSessionTaskClasses() -> [AnyClass] {
        let configuration = URLSessionConfiguration.ephemeral
        let session = URLSession(configuration: configuration)

        let localDataTask = session.dataTask(with: URL(string: "msr")!)

        var currentClass: AnyClass = type(of: localDataTask)
        var result: [AnyClass] = []

        let setStateSelector = NSSelectorFromString("setState:")

        while (class_getInstanceMethod(currentClass, setStateSelector) != nil) {  // swiftlint:disable:this control_statement
            guard let superClass = currentClass.superclass() else { break }

            if class_getInstanceMethod(currentClass, setStateSelector) != nil && class_getInstanceMethod(superClass, setStateSelector) == nil {
                result.append(currentClass)
                currentClass = superClass
                break
            }
            if class_getInstanceMethod(currentClass, setStateSelector) == nil && class_getInstanceMethod(superClass, setStateSelector) != nil {
                result.append(currentClass)
                currentClass = superClass
                break
            }
            if let classSetState = class_getInstanceMethod(currentClass, setStateSelector),
               let superclassSetState = class_getInstanceMethod(superClass, setStateSelector) {
                let classIMP = method_getImplementation(classSetState)
                let superclassIMP = method_getImplementation(superclassSetState)
                if classIMP != superclassIMP {
                    result.append(currentClass)
                }
            }
            currentClass = superClass
        }

        localDataTask.cancel()
        session.invalidateAndCancel()

        return result
    }
}

extension URLSessionTask {
    @objc fileprivate func setStateSwizzled(state: URLSessionTask.State) {
        URLSessionTaskInterceptor.shared.urlSessionTask(self, setState: state)
        self.setStateSwizzled(state: state)
    }
}
