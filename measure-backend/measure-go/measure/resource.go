package measure

import (
	"fmt"
	"measure-backend/measure-go/platform"
)

type Resource struct {
	DeviceName         string  `json:"device_name"`
	DeviceModel        string  `json:"device_model"`
	DeviceManufacturer string  `json:"device_manufacturer"`
	DeviceType         string  `json:"device_type"`
	DeviceIsFoldable   bool    `json:"device_is_foldable"`
	DeviceIsPhysical   bool    `json:"device_is_physical"`
	DeviceDensityDPI   uint16  `json:"device_density_dpi"`
	DeviceWidthPX      uint16  `json:"device_width_px"`
	DeviceHeightPX     uint16  `json:"device_height_px"`
	DeviceDensity      float32 `json:"device_density"`
	DeviceLocale       string  `json:"device_locale"`
	OSName             string  `json:"os_name"`
	OSVersion          string  `json:"os_version"`
	Platform           string  `json:"platform"`
	AppVersion         string  `json:"app_version"`
	AppBuild           string  `json:"app_build"`
	AppUniqueID        string  `json:"app_unique_id"`
	MeasureSDKVersion  string  `json:"measure_sdk_version"`
	NetworkType        string  `json:"network_type"`
	NetworkGeneration  string  `json:"network_generation"`
	NetworkProvider    string  `json:"network_provider"`
}

func (r *Resource) validate() error {
	const (
		maxDeviceNameChars         = 32
		maxDeviceModelChars        = 32
		maxDeviceManufacturerChars = 32
		maxDeviceTypeChars         = 32
		maxOSNameChars             = 32
		maxOSVersionChars          = 32
		maxPlatformChars           = 32
		maxAppVersionChars         = 32
		maxAppBuildChars           = 32
		maxAppUniqueIDChars        = 128
		maxMeasureSDKVersion       = 16
		maxNetworkTypeChars        = 16
		maxNetworkGenerationChars  = 8
		maxNetworkProviderChars    = 64
		maxDeviceLocaleChars       = 64
	)

	if len(r.DeviceName) > maxDeviceNameChars {
		return fmt.Errorf(`"resource.device_name" exceeds maximum allowed characters of (%d)`, maxDeviceNameChars)
	}
	if len(r.DeviceModel) > maxDeviceModelChars {
		return fmt.Errorf(`"resource.device_model" exceeds maximum allowed characters of (%d)`, maxDeviceModelChars)
	}
	if len(r.DeviceManufacturer) > maxDeviceManufacturerChars {
		return fmt.Errorf(`"resource.device_manufacturer" exceeds maximum allowed characters of (%d)`, maxDeviceManufacturerChars)
	}
	if len(r.DeviceType) > maxDeviceTypeChars {
		return fmt.Errorf(`"resource.device_type" exceeds maximum allowed characters of (%d)`, maxDeviceTypeChars)
	}
	if len(r.OSName) > maxOSNameChars {
		return fmt.Errorf(`"resource.os_name" exceeds maximum allowed characters of (%d)`, maxOSNameChars)
	}
	if len(r.OSVersion) > maxOSVersionChars {
		return fmt.Errorf(`"resource.os_version" exceeds maximum allowed characters of (%d)`, maxOSVersionChars)
	}
	if len(r.Platform) > maxPlatformChars {
		return fmt.Errorf(`"resource.platform" exceeds maximum allowed characters of (%d)`, maxPlatformChars)
	}
	if r.Platform != platform.Android && r.Platform != platform.IOS {
		return fmt.Errorf(`"resource.platform" does not contain a valid platform value`)
	}
	if len(r.AppVersion) > maxAppVersionChars {
		return fmt.Errorf(`"resource.app_version" exceeds maximum allowed characters of (%d)`, maxAppVersionChars)
	}
	if len(r.AppBuild) > maxAppBuildChars {
		return fmt.Errorf(`"resource.app_build" exceeds maximum allowed characters of (%d)`, maxAppBuildChars)
	}
	if len(r.AppUniqueID) > maxAppUniqueIDChars {
		return fmt.Errorf(`"resource.app_unique_id" exceeds maximum allowed characters of (%d)`, maxAppUniqueIDChars)
	}
	if len(r.MeasureSDKVersion) > maxMeasureSDKVersion {
		return fmt.Errorf(`"resource.measure_sdk_version" exceeds maximum allowed characters of (%d)`, maxMeasureSDKVersion)
	}
	if len(r.NetworkType) > maxNetworkTypeChars {
		return fmt.Errorf(`"resource.network_type" exceeds maximum allowed characters of (%d)`, 16)
	}
	if len(r.NetworkGeneration) > maxNetworkGenerationChars {
		return fmt.Errorf(`"resource.network_generation" exceeds maximum allowed characters of (%d)`, maxNetworkGenerationChars)
	}
	if len(r.NetworkProvider) > maxNetworkProviderChars {
		return fmt.Errorf(`"resource.network_provider" exceeds maximum allowed characters of (%d)`, maxNetworkProviderChars)
	}
	if len(r.DeviceLocale) > maxDeviceLocaleChars {
		return fmt.Errorf(`"resource.device_locale" exceeds maximum allowed characters of (%d)`, maxDeviceLocaleChars)
	}

	return nil
}
