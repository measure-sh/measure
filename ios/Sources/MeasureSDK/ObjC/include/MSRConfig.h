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

/// The sampling rate for non-crashed sessions. Must be between 0.0 and 1.0. Defaults to 0.
@property (nonatomic) float samplingRateForErrorFreeSessions;

/// The sampling rate for traces. Must be between 0.0 and 1.0. Defaults to 0.0001.
/// For example, a value of `0.1` will export only 10% of all traces, a value of `0` will disable exporting of traces.
@property (nonatomic) float traceSamplingRate;

/// The sampling rate for cold launch times. Must be between 0.0 and 1.0. Defaults to 0.01.
@property (nonatomic) float coldLaunchSamplingRate;

/// The sampling rate for warm launch times. Must be between 0.0 and 1.0. Defaults to 0.01.
@property (nonatomic) float warmLaunchSamplingRate;

/// The sampling rate for hot launch times. Must be between 0.0 and 1.0. Defaults to 0.01.
@property (nonatomic) float hotLaunchSamplingRate;

/// Configures sampling rate for sessions that track "user journeys". This feature shows traffic of users across different screens of the app.
/// When set to 0, the journey will only be generated from crashed sessions or sessions collected using `samplingRateForErrorFreeSessions`
///
/// Defaults to 0.
///
/// If a value of 0.1 is set, then 10% of the sessions will contain events required to build the journey which includes screen view, lifecycle view controller.
@property (nonatomic) float journeySamplingRate;

/// Set to false to delay starting the SDK, by default initializing the SDK also starts tracking. Defaults to true.
@property (nonatomic) BOOL autoStart;

/// Whether to capture http headers of a network request and response. Defaults to `false`.
@property (nonatomic) BOOL trackHttpHeaders;

/// Whether to capture http body of a network request and response. Defaults to `false`.
@property (nonatomic) BOOL trackHttpBody;

/// List of HTTP headers to not collect with the `http` event for both request and response.
/// Defaults to an empty list. The following headers are always excluded:
/// - * Authorization
/// - * Cookie
/// - * Set-Cookie
/// - * Proxy-Authorization
/// - * WWW-Authenticate
/// - * X-Api-Key
///
@property (nonatomic, copy) NSArray<NSString *> *httpHeadersBlocklist;

/// Allows disabling collection of `http` events for certain URLs. This is useful to setup if you do not want to collect data for certain endpoints.
///
/// Note that this config is ignored if [httpUrlAllowlist] is set.
///
/// You can:
/// - Disables a domain, eg. example.com
/// - Disable a subdomain, eg. api.example.com
/// - Disable a particular path, eg. example.com/order
///
@property (nonatomic, copy) NSArray<NSString *> *httpUrlBlocklist;

/// Allows enabling collection of `http` events for only certain URLs. This is useful to setup if you do not want to collect data for all endpoints except for a few.
///
/// You can:
/// - Disables a domain, eg. example.com
/// - Disable a subdomain, eg. api.example.com
/// - Disable a particular path, eg. example.com/order
///
@property (nonatomic, copy) NSArray<NSString *> *httpUrlAllowlist;

/// Allows changing the masking level of screenshots to prevent sensitive information from leaking.
/// Defaults to [ScreenshotMaskLevel.allTextAndMedia].
@property (nonatomic) ScreenshotMaskingLevel screenshotMaskLevel;

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
        samplingRateForErrorFreeSessions:(float)samplingRateForErrorFreeSessions
                     traceSamplingRate:(float)traceSamplingRate
              coldLaunchSamplingRate:(float)coldLaunchSamplingRate
              warmLaunchSamplingRate:(float)warmLaunchSamplingRate
                hotLaunchSamplingRate:(float)hotLaunchSamplingRate
                  journeySamplingRate:(float)journeySamplingRate
                    trackHttpHeaders:(BOOL)trackHttpHeaders
                       trackHttpBody:(BOOL)trackHttpBody
               httpHeadersBlocklist:(NSArray<NSString *> *)httpHeadersBlocklist
                    httpUrlBlocklist:(NSArray<NSString *> *)httpUrlBlocklist
                   httpUrlAllowlist:(NSArray<NSString *> *)httpUrlAllowlist
                           autoStart:(BOOL)autoStart
                screenshotMaskLevel:(ScreenshotMaskingLevel)screenshotMaskLevel
             requestHeadersProvider:(nullable id<MsrRequestHeadersProvider>)requestHeadersProvider
                 maxDiskUsageInMb:(NSNumber *)maxDiskUsageInMb NS_DESIGNATED_INITIALIZER;

- (instancetype)init NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END
