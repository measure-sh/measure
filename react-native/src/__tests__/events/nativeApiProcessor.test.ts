import { NativeApiProcessor } from '../../events/nativeApiProcessor';
import { internalSetPatch, setUserId } from '../../native/measureBridge';

jest.mock('../../native/measureBridge', () => ({
  setUserId: jest.fn(() => Promise.resolve()),
  clearUserId: jest.fn(() => Promise.resolve()),
  internalSetPatch: jest.fn(() => Promise.resolve()),
}));

const VALID_PATCH_ID = '3f2b8c1e-7a4d-4e9b-9c6f-1d2e3f4a5b6c';

describe('NativeApiProcessor', () => {
  let logger: { log: jest.Mock; internalLog: jest.Mock };
  let processor: NativeApiProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = { log: jest.fn(), internalLog: jest.fn() };
    processor = new NativeApiProcessor({ logger: logger as any });
  });

  describe('setUserId', () => {
    it('sets a user ID of 128 characters', () => {
      const userId = 'u'.repeat(128);

      processor.setUserId(userId);

      expect(setUserId).toHaveBeenCalledWith(userId);
    });

    it('ignores a user ID longer than 128 characters', () => {
      processor.setUserId('u'.repeat(129));

      expect(setUserId).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(
        'error',
        '[NativeApiProcessor] User ID exceeds maximum length of 128 characters and will be ignored.'
      );
    });
  });

  describe('internalSetPatch', () => {
    it('sets a valid patch ID and version', () => {
      processor.internalSetPatch(VALID_PATCH_ID, 'v1.0.3');

      expect(internalSetPatch).toHaveBeenCalledWith(VALID_PATCH_ID, 'v1.0.3');
    });

    it('ignores a patch ID that is not a UUID', () => {
      processor.internalSetPatch('not-a-uuid', 'v1.0.3');

      expect(internalSetPatch).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(
        'error',
        '[NativeApiProcessor] Patch ID not-a-uuid is not a valid UUID and will be ignored.'
      );
    });

    it('truncates a patch version longer than 256 characters', () => {
      processor.internalSetPatch(VALID_PATCH_ID, 'p'.repeat(257));

      expect(internalSetPatch).toHaveBeenCalledWith(
        VALID_PATCH_ID,
        'p'.repeat(256)
      );
    });

    it('sets a patch ID without a version', () => {
      processor.internalSetPatch(VALID_PATCH_ID);

      expect(internalSetPatch).toHaveBeenCalledWith(VALID_PATCH_ID, undefined);
    });
  });
});
