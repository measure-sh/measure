import { isMeasureHost } from '@/app/utils/url_utils';
import { describe, expect, it } from '@jest/globals';

describe('isMeasureHost', () => {
    it('should return true for measure.sh', () => {
        delete (global as any).window;
        (global as any).window = {
            location: {
                origin: 'https://measure.sh'
            }
        };

        expect(isMeasureHost()).toBe(true);
    });

    it('should return true for staging.measure.sh', () => {
        delete (global as any).window;
        (global as any).window = {
            location: {
                origin: 'https://staging.measure.sh'
            }
        };

        expect(isMeasureHost()).toBe(true);
    });

    it('should return false for other hosts', () => {
        delete (global as any).window;
        (global as any).window = {
            location: {
                origin: 'https://example.com'
            }
        };

        expect(isMeasureHost()).toBe(false);
    });

    it('should return false when window is undefined', () => {
        delete (global as any).window;

        expect(isMeasureHost()).toBe(false);
    });

    it('should return false when window.location.origin is empty', () => {
        delete (global as any).window;
        (global as any).window = {
            location: {
                origin: ''
            }
        };

        expect(isMeasureHost()).toBe(false);
    });

    it('should return false for invalid URL', () => {
        delete (global as any).window;
        (global as any).window = {
            location: {
                origin: 'not-a-valid-url'
            }
        };

        expect(isMeasureHost()).toBe(false);
    });
});