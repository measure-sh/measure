export function isMeasureHost(): boolean {
    const url =
        typeof window !== 'undefined' && window.location.origin
            ? window.location.origin
            : '';
    try {
        const { host } = new URL(url);
        return host === 'measure.sh' || host === 'staging.measure.sh';
    } catch (error) {
        return false;
    }
}