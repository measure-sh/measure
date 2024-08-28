//
//  MeasureManager.h
//  MeasureDemo
//
//  Created by Adwin Ross on 27/08/24.
//

#import <Foundation/Foundation.h>
#import "MeasureSDK/MeasureSDK.h"

NS_ASSUME_NONNULL_BEGIN

@interface MeasureManager : NSObject

@property (nonatomic, strong, readonly) Measure *measure;

- (void)initializeMeasureSDKWithConfig:(nullable BaseMeasureConfig *)config;

@end

NS_ASSUME_NONNULL_END
