//
//  ScreenshotMaskLevelObjc.h
//  Measure
//
//  Created by Adwin Ross on 16/12/25.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// The level of masking to apply to screenshots captured by the Measure SDK.
///
/// This enum controls how aggressively sensitive content is redacted
/// when screenshots are captured for bug reports or diagnostics.
typedef NS_ENUM(NSInteger, ScreenshotMaskingLevel) {

    /// The strictest level of masking.
    /// Masks all text, input fields, images, and videos.
    ScreenshotMaskingLevelAllTextAndMedia = 0,

    /// Masks all text and input fields, including clickable elements.
    ScreenshotMaskingLevelAllText,

    /// Masks all text and input fields, excluding clickable elements.
    ScreenshotMaskingLevelAllTextExceptClickable,

    /// The most lenient level of masking.
    /// Only masks sensitive input fields such as passwords, email, and phone numbers.
    ScreenshotMaskingLevelSensitiveFieldsOnly
};

NS_ASSUME_NONNULL_END
