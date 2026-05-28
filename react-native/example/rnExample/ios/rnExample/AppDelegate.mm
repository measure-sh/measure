#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <measure-sh/MSRConfig.h>
#import <measure-sh/MeasureSDK.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"rnExample";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  MSRConfig *config = [[MSRConfig alloc] initWithEnableLogging:YES
                                                     autoStart:YES
                                      enableFullCollectionMode:NO
                                        requestHeadersProvider:NULL
                                              maxDiskUsageInMb:@300
                                          enableDiagnosticMode:YES
                                   enableDiagnosticModeGesture:YES];
  [MeasureSDK initializeWithApiKey:@"msrsh_6a9eb7a65fcb216a823042e36e272769021163a6b3aabb02b80dd8687b0985cc_2be25d33" apiUrl:@"https://localhost:8080" config:config];
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}

- (NSURL *)getBundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
