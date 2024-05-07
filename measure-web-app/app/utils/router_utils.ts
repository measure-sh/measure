import { ReadonlyURLSearchParams } from "next/navigation";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

export function updateDateQueryParams(router: AppRouterInstance, searchParams: ReadonlyURLSearchParams, startDate: string, endDate: string) {
    const currentParams = new URLSearchParams(searchParams);
    currentParams.set("start_date", startDate);
    currentParams.set("end_date", endDate);
    router.replace(`?${currentParams.toString()}`, { scroll: false });
};