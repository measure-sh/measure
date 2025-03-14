//
//  MSRViewController.h
//  MeasureSDK
//
//  Created by Adwin Ross on 28/10/24.
//

#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/// A view controller that monitors the `loadView` and `dealloc` lifecycle events of the view controller.
/// This class is intended to be subclassed by view controllers that need to monitor the view controller lifecycle.
///
/// - Example:
///   ```objc
///   @interface ObjcDetailViewController : MSRViewController
///
///   @end
///   ```
@interface MSRViewController : UIViewController

@end

NS_ASSUME_NONNULL_END
