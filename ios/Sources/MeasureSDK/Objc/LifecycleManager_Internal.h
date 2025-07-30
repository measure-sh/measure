//
//  LifecycleManager_Internal.h
//  MeasureSDK
//
//  Created by Adwin Ross on 04/03/25.
//

#import <UIKit/UIKit.h>
#if __has_include(<Measure/Measure-Swift.h>)
#import <Measure/Measure-Swift.h>
#elif __has_include("Measure.h")
#import "Measure.h"
#else
#warning "Measure.h not found. Ensure the Swift interface header is correctly exposed."
#endif

NS_ASSUME_NONNULL_BEGIN

@interface LifecycleManagerInternal : NSObject

+ (instancetype)shared;
- (void)sendLifecycleEvent:(VCLifecycleEventType)event for:(UIViewController *)viewController;

@end

NS_ASSUME_NONNULL_END
