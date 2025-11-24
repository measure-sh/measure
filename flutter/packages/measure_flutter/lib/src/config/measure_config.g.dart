// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'measure_config.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeasureConfig _$MeasureConfigFromJson(Map<String, dynamic> json) =>
    MeasureConfig(
      enableLogging:
          json['enableLogging'] as bool? ?? DefaultConfig.enableLogging,
      trackScreenshotOnCrash: json['trackScreenshotOnCrash'] as bool? ??
          DefaultConfig.trackScreenshotOnCrash,
      autoInitializeNativeSDK: json['autoInitializeNativeSDK'] as bool? ??
          DefaultConfig.autoInitializeNativeSDK,
      autoStart: json['autoStart'] as bool? ?? DefaultConfig.autoStart,
      trackHttpHeaders:
          json['trackHttpHeaders'] as bool? ?? DefaultConfig.trackHttpHeaders,
      trackHttpBody:
          json['trackHttpBody'] as bool? ?? DefaultConfig.trackHttpBody,
      httpHeadersBlocklist: (json['httpHeadersBlocklist'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          DefaultConfig.httpHeadersBlocklist,
      httpUrlBlocklist: (json['httpUrlBlocklist'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          DefaultConfig.httpUrlBlocklist,
      httpUrlAllowlist: (json['httpUrlAllowlist'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          DefaultConfig.httpUrlAllowlist,
      trackActivityIntentData: json['trackActivityIntentData'] as bool? ??
          DefaultConfig.trackActivityIntentData,
      samplingRateForErrorFreeSessions:
          (json['samplingRateForErrorFreeSessions'] as num?)?.toDouble() ??
              DefaultConfig.sessionSamplingRate,
      traceSamplingRate: (json['traceSamplingRate'] as num?)?.toDouble() ??
          DefaultConfig.traceSamplingRate,
      maxDiskUsageInMb: (json['maxDiskUsageInMb'] as num?)?.toInt() ??
          DefaultConfig.maxDiskUsageInMb,
      coldLaunchSamplingRate:
          (json['coldLaunchSamplingRate'] as num?)?.toDouble() ??
              DefaultConfig.coldLaunchSamplingRate,
      warmLaunchSamplingRate:
          (json['warmLaunchSamplingRate'] as num?)?.toDouble() ??
              DefaultConfig.warmLaunchSamplingRate,
      hotLaunchSamplingRate:
          (json['hotLaunchSamplingRate'] as num?)?.toDouble() ??
              DefaultConfig.hotLaunchSamplingRate,
      journeySamplingRate: (json['journeySamplingRate'] as num?)?.toDouble() ??
          DefaultConfig.journeySamplingRate,
    );

Map<String, dynamic> _$MeasureConfigToJson(MeasureConfig instance) =>
    <String, dynamic>{
      'enableLogging': instance.enableLogging,
      'trackScreenshotOnCrash': instance.trackScreenshotOnCrash,
      'autoInitializeNativeSDK': instance.autoInitializeNativeSDK,
      'autoStart': instance.autoStart,
      'trackHttpHeaders': instance.trackHttpHeaders,
      'trackHttpBody': instance.trackHttpBody,
      'httpHeadersBlocklist': instance.httpHeadersBlocklist,
      'httpUrlBlocklist': instance.httpUrlBlocklist,
      'httpUrlAllowlist': instance.httpUrlAllowlist,
      'trackActivityIntentData': instance.trackActivityIntentData,
      'samplingRateForErrorFreeSessions':
          instance.samplingRateForErrorFreeSessions,
      'traceSamplingRate': instance.traceSamplingRate,
      'maxDiskUsageInMb': instance.maxDiskUsageInMb,
      'coldLaunchSamplingRate': instance.coldLaunchSamplingRate,
      'warmLaunchSamplingRate': instance.warmLaunchSamplingRate,
      'hotLaunchSamplingRate': instance.hotLaunchSamplingRate,
      'journeySamplingRate': instance.journeySamplingRate,
    };
