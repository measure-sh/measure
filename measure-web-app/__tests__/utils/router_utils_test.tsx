import { updateDateQueryParams } from "@/app/utils/router_utils";
import { expect, it, describe, jest } from '@jest/globals';
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ReadonlyURLSearchParams } from "next/navigation";

describe('updateDateQueryParams', () => {
    it('should update the query params with the provided start and end dates', () => {
        const routerMock: jest.Mocked<AppRouterInstance> = {
            back: jest.fn(),
            forward: jest.fn(),
            refresh: jest.fn(),
            push: jest.fn(),
            prefetch: jest.fn(),
            replace: jest.fn(),
        };
        const urlSearchParams = new URLSearchParams('?foo=bar');
        const readonlySearchParams = new ReadonlyURLSearchParams(urlSearchParams);
        const startDate = '2023-04-20';
        const endDate = '2023-04-25';
        const expectedQueryString = 'foo=bar&start_date=2023-04-20&end_date=2023-04-25';

        updateDateQueryParams(routerMock, readonlySearchParams, startDate, endDate);

        expect(routerMock.replace).toHaveBeenCalledWith(`?${expectedQueryString}`, { scroll: false });
    });
});