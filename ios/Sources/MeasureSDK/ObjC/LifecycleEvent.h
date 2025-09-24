//
//  LifecycleEvent.h
//  MeasureSDK
//
//  Created by Adwin Ross on 27/08/25.
//

#ifndef LifecycleEvent_h
#define LifecycleEvent_h

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, MSRVCLifecycleEventType) {
    MSRVCLifecycleEventTypeLoadView = 8,
    MSRVCLifecycleEventTypeVcDeinit = 9
};

// Forward declarations so ObjC knows they exist
@class LifecycleManagerInternal;

NS_ASSUME_NONNULL_END

#endif /* LifecycleEvent_h */
