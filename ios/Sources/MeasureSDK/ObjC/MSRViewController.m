//
//  MSRViewController.m
//  MeasureSDK
//
//  Created by Adwin Ross on 28/10/24.
//

#import "MSRViewController.h"
#import "LifecycleManager_Internal.h"

@implementation MSRViewController

- (void)loadView {
    [super loadView];
    [LifecycleManagerInternal.shared sendLifecycleEvent:MSRVCLifecycleEventTypeLoadView for:self];
}

- (void)dealloc {
    [LifecycleManagerInternal.shared sendLifecycleEvent:MSRVCLifecycleEventTypeVcDeinit for:self];
}

@end
