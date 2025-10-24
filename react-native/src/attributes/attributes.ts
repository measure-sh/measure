export enum NetworkGeneration {
    Generation2 = "2g",
    Generation3 = "3g",
    Generation4 = "4g",
    Generation5 = "5g",
    Unknown = "unknown",
}

export enum NetworkType {
    NoNetwork = "no_network",
    Cellular = "cellular",
    Wifi = "wifi",
    Vpn = "vpn",
    Unknown = "unknown",
}

export enum DeviceType {
    Tablet = "tablet",
    Phone = "phone",
}

export interface IAttributes {
    threadName?: string;
    deviceName?: string;
    deviceModel?: string;
    deviceManufacturer?: string;
    deviceType?: DeviceType;
    deviceIsFoldable?: boolean;
    deviceIsPhysical?: boolean;
    deviceDensityDpi?: number;
    deviceWidthPx?: number;
    deviceHeightPx?: number;
    deviceDensity?: number;
    deviceLocale?: string;
    osName?: string;
    osVersion?: string;
    platform: string;
    networkType?: NetworkType;
    networkGeneration?: NetworkGeneration;
    networkProvider?: string;
    installationId: string;
    userId?: string;
    deviceCpuArch?: string;
    appVersion: string;
    appBuild: string;
    measureSdkVersion: string;
    appUniqueId: string;
    deviceThermalThrottlingEnabled?: boolean;
    deviceLowPowerMode?: boolean;
    osPageSize?: number;
}

export class Attributes implements IAttributes {
    public threadName?: string;
    public deviceName?: string;
    public deviceModel?: string;
    public deviceManufacturer?: string;
    public deviceType?: DeviceType;
    public deviceIsFoldable?: boolean;
    public deviceIsPhysical?: boolean;
    public deviceDensityDpi?: number;
    public deviceWidthPx?: number;
    public deviceHeightPx?: number;
    public deviceDensity?: number;
    public deviceLocale?: string;
    public osName?: string;
    public osVersion?: string;
    public platform: string;
    public networkType?: NetworkType;
    public networkGeneration?: NetworkGeneration;
    public networkProvider?: string;
    public installationId: string;
    public userId?: string;
    public deviceCpuArch?: string;
    public appVersion: string;
    public appBuild: string;
    public measureSdkVersion: string;
    public appUniqueId: string;
    public deviceThermalThrottlingEnabled?: boolean;
    public deviceLowPowerMode?: boolean;
    public osPageSize?: number;

    /**
     * Map of camelCase property names to their snake_case JSON keys for serialization.
     */
    private static readonly CodingKeys: Record<keyof IAttributes, string> = {
        threadName: "thread_name",
        deviceName: "device_name",
        deviceModel: "device_model",
        deviceManufacturer: "device_manufacturer",
        deviceType: "device_type",
        deviceIsFoldable: "device_is_foldable",
        deviceIsPhysical: "device_is_physical",
        deviceDensityDpi: "device_density_dpi",
        deviceWidthPx: "device_width_px",
        deviceHeightPx: "device_height_px",
        deviceDensity: "device_density",
        deviceLocale: "device_locale",
        osName: "os_name",
        osVersion: "os_version",
        platform: "platform",
        networkType: "network_type",
        networkGeneration: "network_generation",
        networkProvider: "network_provider",
        installationId: "installation_id",
        userId: "user_id",
        deviceCpuArch: "device_cpu_arch",
        appVersion: "app_version",
        appBuild: "app_build",
        measureSdkVersion: "measure_sdk_version",
        appUniqueId: "app_unique_id",
        deviceThermalThrottlingEnabled: "device_thermal_throttling_enabled",
        deviceLowPowerMode: "device_low_power_mode",
        osPageSize: "os_page_size"
    } as const;

    constructor({
        threadName = undefined,
        deviceName = undefined,
        deviceModel = undefined,
        deviceManufacturer = undefined,
        deviceType = undefined,
        deviceIsFoldable = undefined,
        deviceIsPhysical = undefined,
        deviceDensityDpi = undefined,
        deviceWidthPx = undefined,
        deviceHeightPx = undefined,
        deviceDensity = undefined,
        deviceLocale = undefined,
        osName = undefined,
        osVersion = undefined,
        platform = "react_native",
        networkType = undefined,
        networkGeneration = undefined,
        networkProvider = undefined,
        installationId = "",
        userId = undefined,
        deviceCpuArch = undefined,
        appVersion = "",
        appBuild = "",
        measureSdkVersion = "",
        appUniqueId = "",
        deviceThermalThrottlingEnabled = undefined,
        deviceLowPowerMode = undefined,
        osPageSize = undefined,
    }: Partial<IAttributes> = {}) {
        this.threadName = threadName;
        this.deviceName = deviceName;
        this.deviceModel = deviceModel;
        this.deviceManufacturer = deviceManufacturer;
        this.deviceType = deviceType;
        this.deviceIsFoldable = deviceIsFoldable;
        this.deviceIsPhysical = deviceIsPhysical;
        this.deviceDensityDpi = deviceDensityDpi;
        this.deviceWidthPx = deviceWidthPx;
        this.deviceHeightPx = deviceHeightPx;
        this.deviceDensity = deviceDensity;
        this.deviceLocale = deviceLocale;
        this.osName = osName;
        this.osVersion = osVersion;
        this.platform = platform;
        this.networkType = networkType;
        this.networkGeneration = networkGeneration;
        this.networkProvider = networkProvider;
        this.installationId = installationId;
        this.userId = userId;
        this.deviceCpuArch = deviceCpuArch;
        this.appVersion = appVersion;
        this.appBuild = appBuild;
        this.measureSdkVersion = measureSdkVersion;
        this.appUniqueId = appUniqueId;
        this.deviceThermalThrottlingEnabled = deviceThermalThrottlingEnabled;
        this.deviceLowPowerMode = deviceLowPowerMode;
        this.osPageSize = osPageSize;
    }

    /**
     * Converts the internal camelCase properties of the class into a Record<string, any>
     * using the snake_case keys defined in the Swift CodingKeys for external use (e.g., JSON export).
     * @returns A map of attributes with snake_case keys.
     */
    public toRecord(): Record<string, any> {
        const record: Record<string, any> = {};

        for (const [prop, jsonKey] of Object.entries(Attributes.CodingKeys) as [keyof IAttributes, string][]) {
            const value = this[prop];

            if (value !== undefined && value !== null) {
                record[jsonKey] = value;
            }
        }
        return record;
    }
}