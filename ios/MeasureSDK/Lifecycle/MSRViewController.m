//
//  MSRViewController.m
//  MeasureSDK
//
//  Created by Adwin Ross on 28/10/24.
//

#import "MSRViewController.h"
#import <MeasureSDK/MeasureSDK-Swift.h>

@interface MSRViewController ()

@end

@implementation MSRViewController

- (void)loadView {
    [super loadView];
    [LifecycleManager.shared sendLifecycleEvent:VCLifecycleEventTypeLoadView for:self];
}

- (void)dealloc {
    [LifecycleManager.shared sendLifecycleEvent:VCLifecycleEventTypeVcDeinit for:self];
}

@end