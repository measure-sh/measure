# Network Connectivity Changes

* [**Android**](#android)
* [**iOS**](#ios)]
* [**Flutter**](#flutter)
* [**Data collected**](#data-collected)

Measure SDK captures changes to network connection state of the device. This includes changes to the type of network
connection (WiFi, Mobile, etc.), the network provider (Airtel, T-Mobile, etc.), and the network generation (2G, 3G, 4G,
etc.).

## Android

> [!NOTE]  
> The SDK does not add any new permissions to the app. It only uses the permissions that the app already has.
> Network connection state change feature is only enabled if the necessary permissions are already granted
> to the app.

Measure monitors changes in network. It is enabled only when the app is granted the
ACCESS_NETWORK_STATE permission and the device is running on Android M (SDK 23) or a higher version.
Measure does not add any new permissions to the app. It only uses the permissions that the app already has.

Tracking of [network_generation] is limited to Cellular network for Android M (SDK 23) and later.
This requires the app to hold the [READ_PHONE_STATE](https://developer.android.com/reference/android/Manifest.permission#READ_PHONE_STATE)
permission, which is a runtime permission. In case the user denies this permission, network generation will not be captured. For devices running
Android Tiramisu (SDK 33) or later, [READ_BASIC_PHONE_STATE](https://developer.android.com/reference/android/Manifest.permission#READ_BASIC_PHONE_STATE)
permission is sufficient, and it does not require a runtime permission.

## iOS

To detect network changes, Measure relies on NWPathMonitor's `pathUpdateHandler`. The `pathUpdateHandler` provides a callback whenever the network changes between cellular and Wi-Fi. Additionally, we perform independent checks to detect if the connection is accessed via VPN or if no internet is available. We rely on `CTTelephonyNetworkInfo` to get carrier information.

> [!IMPORTANT]  
> Starting from iOS 16.4, access to the `network_provider` is no longer available and will be removed in a future 
> release of the SDK. 


## Flutter

Network changes are collected for Flutter apps based on the platform the app is running on (Android or iOS). The SDK uses the
same methods as described above for Android and iOS.

## React Native

Network changes are collected for React Native apps based on the platform the app is running on (Android or iOS). The SDK uses the
same methods as described above for Android and iOS.

## Data collected

Checkout the data collected by Measure for each network change in the [Network Event](../../api/sdk/README.md#networkchange) section.

