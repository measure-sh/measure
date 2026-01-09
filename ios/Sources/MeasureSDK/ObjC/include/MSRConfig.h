//
//  MSRConfig.h
//  Measure
//
//  Created by Adwin Ross on 16/12/25.
//

#import <Foundation/Foundation.h>
#if __has_include(<Measure/ScreenshotMaskingLevel.h>)
#import <Measure/ScreenshotMaskingLevel.h>
#elif __has_include("ScreenshotMaskingLevel.h")
#import "ScreenshotMaskingLevel.h"
#else
#warning "ScreenshotMaskingLevel.h not found. Swift integration may not work."
#endif

NS_ASSUME_NONNULL_BEGIN

@protocol MsrRequestHeadersProvider;

/// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
@interface MSRConfig : NSObject

/// Whether to enable internal SDK logging. Defaults to `false`.
@property (nonatomic) BOOL enableLogging;

/// Set to false to delay starting the SDK, by default initializing the SDK also starts tracking. Defaults to true.
@property (nonatomic) BOOL autoStart;

/// Override all sampling configs and track all events and traces.
/// **Note** that enabling this flag can significantly increase the cost and should typically only be enabled for debug mode.
@property (nonatomic) BOOL enableFullCollectionMode;

/// Allows configuring custom HTTP headers for requests made by the Measure SDK to the Measure API.
///
/// This is useful only for self-hosted clients who may require additional headers for requests in their infrastructure.
@property (nonatomic, strong, nullable) id<MsrRequestHeadersProvider> requestHeadersProvider;

/// Configures the maximum disk usage in megabytes that the Measure SDK is allowed to use.
///
/// This is useful to control the amount of disk space used by the SDK for storing session data,
/// crash reports, and other collected information.
///
/// Defaults to `50MB`. Allowed values are between `20MB` and `1500MB`. Any value outside this
/// range will be clamped to the nearest limit.
///
/// All Measure SDKs store data to disk and upload it to the server in batches. While the app is
/// in foreground, the data is synced periodically and usually the disk space used by the SDK is
/// low. However, if the device is offline or the server is unreachable, the SDK will continue to
/// store data on disk until it reaches the maximum disk usage limit.
///
/// Note that the storage usage is not exact and works on estimates and typically the SDK will
/// use much less disk space than the configured limit. When the SDK reaches the maximum disk
/// usage limit, it will start deleting the oldest data to make space for new data.
@property (nonatomic) NSNumber *maxDiskUsageInMb;

/// Configuration options for the Measure SDK. Used to customize the behavior of the SDK on initialization.
- (instancetype)initWithEnableLogging:(BOOL)enableLogging
                           autoStart:(BOOL)autoStart
             enableFullCollectionMode:(BOOL)enableFullCollectionMode
             requestHeadersProvider:(nullable id<MsrRequestHeadersProvider>)requestHeadersProvider
                 maxDiskUsageInMb:(NSNumber *)maxDiskUsageInMb NS_DESIGNATED_INITIALIZER;

- (instancetype)init NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END
