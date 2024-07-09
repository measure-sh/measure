import { getUserIdOrRedirectToAuth, logout, logoutIfAuthError } from '@/app/utils/auth_utils';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

const mockAuth = {
    getSession: jest.fn(),
    signout: jest.fn(),
    clearSession: jest.fn()
};

const mockRouter = {
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    push: jest.fn()
}

describe('getUserIdOrRedirectToAuth', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('returns user id if session is valid', async () => {
        const userId = 'user-123';
        const sessionData = {
            session: { user: { id: userId } },
            error: null,
        };

        mockAuth.getSession.mockImplementation(() => sessionData)

        // @ts-ignore
        const result = await getUserIdOrRedirectToAuth(mockAuth, mockRouter);

        expect(result).toBe(userId);
        expect(mockAuth.signout).not.toHaveBeenCalled();
        expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('logs out and redirects to auth if session retrieval fails', async () => {
        const error = new Error('Session retrieval failed');
        const sessionData = {
            data: { session: null },
            error: error
        };
        mockAuth.getSession.mockImplementation(() => sessionData)

        // @ts-ignore
        const result = await getUserIdOrRedirectToAuth(mockAuth, mockRouter);

        expect(result).toBeNull();
        expect(mockAuth.signout).toHaveBeenCalled();
        expect(mockRouter.push).toHaveBeenCalledWith('/auth/logout');
    });
})

describe('logoutIfAuthError', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('logs out and redirects to auth if API response has a 401 error', async () => {
        const mockResponse = {
            status: 401
        };

        // @ts-ignore
        await logoutIfAuthError(mockAuth, mockRouter, mockResponse);

        expect(mockAuth.signout).toHaveBeenCalled();
        expect(mockRouter.push).toHaveBeenCalledWith('/auth/logout');
    });

    it('does not log out or redirect if API response does not have a 401 error', async () => {
        const mockResponse = {
            status: 200
        };

        // @ts-ignore
        await logoutIfAuthError(mockAuth, mockRouter, mockResponse);

        expect(mockAuth.signout).not.toHaveBeenCalled();
        expect(mockRouter.push).not.toHaveBeenCalled();
    });
});

describe('logout', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('logs out and redirects to auth', async () => {
        // @ts-ignore
        await logout(mockAuth, mockRouter);

        expect(mockRouter.push).toHaveBeenCalledWith('/auth/logout');
    });
});