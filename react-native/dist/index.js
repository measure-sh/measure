import { NativeModules } from 'react-native';
const { MeasureBridge } = NativeModules;
export function initMeasure() {
    if (MeasureBridge && typeof MeasureBridge.start === 'function') {
        console.log('[Measure RN] Calling native MeasureBridge.start...');
        MeasureBridge.start('your_api_key_here'); // Replace with dynamic config if needed
    }
    else {
        console.warn('[Measure RN] MeasureBridge native module not found.');
    }
}
