// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'measure_config.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MeasureConfig _$MeasureConfigFromJson(Map<String, dynamic> json) =>
    MeasureConfig(
      enableLogging:
          json['enableLogging'] as bool? ?? DefaultConfig.enableLogging,
      autoInitializeNativeSDK: json['autoInitializeNativeSDK'] as bool? ??
          DefaultConfig.autoInitializeNativeSDK,
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
      trackActivityLoadTime: json['trackActivityLoadTime'] as bool? ??
          DefaultConfig.trackActivityLoadTime,
      trackFragmentLoadTime: json['trackFragmentLoadTime'] as bool? ??
          DefaultConfig.trackFragmentLoadTime,
      trackViewControllerLoadTime:
          json['trackViewControllerLoadTime'] as bool? ??
              DefaultConfig.trackViewControllerLoadTime,
    );

Map<String, dynamic> _$MeasureConfigToJson(MeasureConfig instance) =>
    <String, dynamic>{
      'enableLogging': instance.enableLogging,
      'autoInitializeNativeSDK': instance.autoInitializeNativeSDK,
      'trackHttpHeaders': instance.trackHttpHeaders,
      'trackHttpBody': instance.trackHttpBody,
      'httpHeadersBlocklist': instance.httpHeadersBlocklist,
      'httpUrlBlocklist': instance.httpUrlBlocklist,
      'httpUrlAllowlist': instance.httpUrlAllowlist,
      'trackActivityIntentData': instance.trackActivityIntentData,
      'samplingRateForErrorFreeSessions':
          instance.samplingRateForErrorFreeSessions,
      'traceSamplingRate': instance.traceSamplingRate,
      'trackActivityLoadTime': instance.trackActivityLoadTime,
      'trackFragmentLoadTime': instance.trackFragmentLoadTime,
      'trackViewControllerLoadTime': instance.trackViewControllerLoadTime,
    };
