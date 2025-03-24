//
//  LifecycleManager_Internal.h
//  MeasureSDK
//
//  Created by Adwin Ross on 04/03/25.
//

#import <UIKit/UIKit.h>
#import <Measure/Measure-Swift.h>

NS_ASSUME_NONNULL_BEGIN

@interface LifecycleManagerInternal : NSObject

+ (instancetype)shared;
- (void)sendLifecycleEvent:(VCLifecycleEventType)event for:(UIViewController *)viewController;

@end

NS_ASSUME_NONNULL_END
