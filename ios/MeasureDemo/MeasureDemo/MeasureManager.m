//
//  MeasureManager.m
//  MeasureDemo
//
//  Created by Adwin Ross on 27/08/24.
//

#import "MeasureManager.h"

@implementation MeasureManager

- (void)initializeMeasureSDKWithConfig:(nullable BaseMeasureConfig *)config clientInfo:(nullable ClientInfo *)clientInfo {
    _measure = [Measure shared];
    [_measure initializeWith:clientInfo config:config];
}

@end
