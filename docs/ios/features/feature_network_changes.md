# Feature - Network Changes

Measure SDK captures changes to network connection state of the device. This includes changes to the type of network connection (WiFi, Mobile, etc.), and the network generation (2G, 3G, 4G, etc.).

## How it works

To detect network changes, Measure relies on NWPathMonitor's `pathUpdateHandler`. The `pathUpdateHandler` provides a callback whenever the network changes between cellular and Wi-Fi. Additionally, we perform independent checks to detect if the connection is accessed via VPN or if no internet is available. We rely on `CTTelephonyNetworkInfo` to get carrier information.

> [!IMPORTANT]  
> Starting from iOS 16.4, access to the `network_provider` is no longer available. This data point might be removed later for iOS.

## Data collected

Checkout the data collected by Measure for each network change in the [Network Event](../../api/sdk/README.md#network_change) section.