import { Server, Settings, Sliders, Smartphone } from 'lucide-react';
import React, { useState } from 'react';
import { Slider } from './slider';

interface AdaptiveCaptureDemoProps {
    showTitle: boolean;
}

interface DataConfig {
    name: string;
    percentage: number;
    targeting: number;
}

interface ConfigState {
    crashes: DataConfig;
    anrs: DataConfig;
    traces: DataConfig;
    logs: DataConfig;
    events: DataConfig;
}

interface Device {
    id: number;
    name: string;
    synced: boolean;
}

const AdaptiveCaptureDemo: React.FC<AdaptiveCaptureDemoProps> = ({ showTitle }) => {
    const [configState, setConfigState] = useState<ConfigState>({
        crashes: { name: "Crashes", percentage: 100, targeting: 3 },
        anrs: { name: "ANRs", percentage: 100, targeting: 1 },
        traces: { name: "Traces", percentage: 0, targeting: 2 },
        logs: { name: "Logs", percentage: 0, targeting: 1 },
        events: { name: " Custom Events", percentage: 0, targeting: 2 }
    });

    const [syncing, setSyncing] = useState<boolean>(false);
    const [devices] = useState<Device[]>([
        { id: 1, name: 'Android - Device 1', synced: true },
        { id: 2, name: 'Android - Device 2', synced: true },
        { id: 3, name: 'iOS - Device 1', synced: true },
        { id: 4, name: 'iOS - Device 2', synced: true }
    ]);

    const updatePercentage = (key: keyof ConfigState, value: number): void => {
        setConfigState(prev => ({
            ...prev,
            [key]: { ...prev[key], percentage: value }
        }));
        setSyncing(true);

        setTimeout(() => {
            setSyncing(false);
        }, 1500);
    };

    const isActive = (config: DataConfig): boolean => config.percentage > 0;

    return (
        <div className="w-full p-4 font-display">
            <div className="w-full mx-auto">
                {showTitle && (
                    <>
                        <p className="font-display text-4xl">Adaptive Capture</p>
                        <div className="py-4" />
                    </>
                )}

                {/* Dashboard Section */}
                <div className="bg-accent border-2 border-border rounded-md p-4 mb-4 shadow-lg">
                    <div className="flex items-center gap-2 mb-4">
                        <Settings className="w-4 h-4 mb-1 text-accent-foreground" />
                        <p className="text-accent-foreground font-display">Dashboard Configuration</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                        {(Object.entries(configState) as [keyof ConfigState, DataConfig][]).map(([key, config]) => {
                            const active = isActive(config);
                            return (
                                <div
                                    key={key}
                                    className={`bg-background text-foreground ${active ? 'border-primary' : 'bg-background border-border opacity-80 dark:opacity-50'} border-2 rounded-md p-4`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm">{config.name}</span>
                                    </div>
                                    <p className="text-xs text-left">{active ? 'Collecting' : 'Disabled'}</p>

                                    <div className="mt-3 pt-3 border-t border-border">
                                        <div className="flex items-center gap-1 mb-1">
                                            <Sliders className="w-3 h-3" />
                                            <span className="text-xs font-semibold">Rate</span>
                                        </div>
                                        <div className="flex items-center gap-1 mb-2">
                                            <Slider
                                                value={[config.percentage]}
                                                onValueChange={(value) => updatePercentage(key, value[0])}
                                                min={0}
                                                max={100}
                                                step={1}
                                                className="flex-1"
                                            />
                                            <span className="text-xs font-display w-8 text-right flex-shrink-0">{config.percentage}%</span>
                                        </div>
                                        {config.targeting > 0 && (
                                            <div className="text-xs text-foreground mt-2">
                                                🎯 {config.targeting} {config.targeting === 1 ? 'filter' : 'filters'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sync Animation */}
                <div className="flex justify-center mb-4">
                    <div className="relative">
                        {syncing && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-3 h-3 bg-primary rounded-full animate-ping"></div>
                            </div>
                        )}
                        <div className="flex flex-col items-center">
                            <div className="w-px h-6 bg-foreground mb-2"></div>
                            <div className={`w-2 h-2 ${syncing ? 'bg-primary animate-pulse' : 'bg-foreground'} rounded-full`}></div>
                            <div className="w-px h-6 bg-foreground mt-2"></div>
                        </div>
                    </div>
                </div>

                {/* Server Section */}
                <div className="bg-accent border-2 border-border rounded-md p-4 md:p-6 mb-4 shadow-lg">
                    <div className="flex items-center gap-2 mb-4">
                        <Server className="w-4 h-4 mb-1 text-accent-foreground" />
                        <p className="text-accent-foreground font-display">Measure Server</p>
                    </div>

                    <div className="bg-background border border-border rounded-md p-4">
                        <div className="text-sm space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-foreground">Config Status:</span>
                                <span className={`${syncing ? 'text-foreground' : 'text-foreground'}`}>
                                    {syncing ? 'Syncing' : 'Synced'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-foreground">Active Rules:</span>
                                <span className="text-foreground">
                                    {Object.values(configState).filter(c => isActive(c)).length} / {Object.keys(configState).length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sync Animation */}
                <div className="flex justify-center mb-4">
                    <div className="relative">
                        {syncing && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-3 h-3 bg-primary rounded-full animate-ping"></div>
                            </div>
                        )}
                        <div className="flex flex-col items-center">
                            <div className="w-px h-6 bg-foreground mb-2"></div>
                            <div className={`w-2 h-2 ${syncing ? 'bg-primary animate-pulse' : 'bg-foreground'} rounded-full`}></div>
                            <div className="w-px h-6 bg-foreground mt-2"></div>
                        </div>
                    </div>
                </div>

                {/* Mobile Devices Section */}
                <div className="bg-accent border-2 border-border rounded-md p-4 md:p-6 shadow-lg">
                    <div className="flex items-center gap-2 mb-4">
                        <Smartphone className="w-4 h-4 mb-1 text-accent-foreground" />
                        <p className="text-accent-foreground font-display">Mobile Devices</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        {devices.map((device) => (
                            <div
                                key={device.id}
                                className={`bg-background border-2 border-border rounded-md p-3`}
                            >
                                <div className="flex flex-col items-start justify-between gap-2">
                                    <div className="flex flex-row items-center gap-2">
                                        <Smartphone className="w-3 h-3 mb-1 text-foreground" />
                                        <p className="text-sm text-foreground">{device.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2.5 px-1">
                                        <div className={`w-1.5 h-1.5 rounded-full bg-foreground ${syncing ? 'animate-pulse' : ''}`}></div>
                                        <span className={`text-xs text-foreground`}>
                                            {syncing ? 'Syncing' : 'Synced'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdaptiveCaptureDemo;