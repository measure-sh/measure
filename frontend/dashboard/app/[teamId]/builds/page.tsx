"use client";
import { useFiltersStore } from "@/app/stores/provider";

import {
  downloadBuildFile,
  emptyBuildsResponse,
  FilterSource,
} from "@/app/api/api_calls";
import { Button } from "@/app/components/button";
import Filters, {
  AppVersionsInitialSelectionType,
} from "@/app/components/filters";
import LoadingBar from "@/app/components/loading_bar";
import Paginator from "@/app/components/paginator";
import { SkeletonListPage } from "@/app/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/table";
import { paginationOffsetUrlKey, useBuildsQuery } from "@/app/query/hooks";
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";

const PAGINATION_LIMIT = 10;

export default function Builds(props: { params: Promise<{ teamId: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useFiltersStore((state) => state.filters);

  // Pagination is component-local state, initialized from URL
  const [paginationOffset, setPaginationOffset] = useState(() => {
    const po = searchParams.get(paginationOffsetUrlKey);
    return po ? parseInt(po) : 0;
  });

  // Reset pagination when filters change (skip pre-ready transitions)
  const prevFiltersRef = useRef<string | null>(null);
  useEffect(() => {
    if (!filters.ready) {
      return;
    }
    if (
      prevFiltersRef.current !== null &&
      prevFiltersRef.current !== filters.serialisedFilters
    ) {
      setPaginationOffset(0);
    }
    prevFiltersRef.current = filters.serialisedFilters;
  }, [filters.ready, filters.serialisedFilters]);

  // URL sync
  useEffect(() => {
    if (!filters.ready) {
      return;
    }
    router.replace(
      `?${paginationOffsetUrlKey}=${encodeURIComponent(paginationOffset)}&${filters.serialisedFilters!}`,
      { scroll: false },
    );
  }, [paginationOffset, filters.ready, filters.serialisedFilters]);

  const {
    data: builds = emptyBuildsResponse,
    status,
    isFetching,
  } = useBuildsQuery(paginationOffset);

  const nextPage = () => setPaginationOffset((o) => o + PAGINATION_LIMIT);
  const prevPage = () =>
    setPaginationOffset((o) => Math.max(0, o - PAGINATION_LIMIT));

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <Filters
        teamId={params.teamId}
        filterSource={FilterSource.Builds}
        appVersionsInitialSelectionType={AppVersionsInitialSelectionType.All}
        showNoData={false}
        showNotOnboarded={false}
        showNoBuilds={true}
        showAppSelector={true}
        showAppVersions={false}
        showDates={true}
        showSessionTypes={false}
        showOsVersions={false}
        showCountries={false}
        showNetworkTypes={false}
        showNetworkProviders={false}
        showNetworkGenerations={false}
        showLocales={false}
        showDeviceManufacturers={false}
        showDeviceNames={false}
        showBugReportStatus={false}
        showHttpMethods={false}
        showUdAttrs={false}
        showFreeText={false}
      />
      <div className="py-4" />

      {filters.loading && <SkeletonListPage />}

      {/* Error state for builds fetch */}
      {filters.ready && status === "error" && (
        <p className="text-lg font-display">
          Error fetching list of builds, please change filters, refresh page or
          select a different app to try again
        </p>
      )}

      {/* Main builds list UI */}
      {filters.ready && (status === "success" || status === "pending") && (
        <div className="flex flex-col items-center w-full">
          <div className="self-end">
            <Paginator
              prevEnabled={isFetching ? false : builds.meta.previous}
              nextEnabled={isFetching ? false : builds.meta.next}
              displayText=""
              onNext={nextPage}
              onPrev={prevPage}
            />
          </div>
          <div
            className={`py-1 w-full ${isFetching ? "visible" : "invisible"}`}
          >
            <LoadingBar />
          </div>
          <div className="py-4" />
          <Table className="font-display select-none">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60%]">Build</TableHead>
                <TableHead className="w-[40%] text-right">Files</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {builds.results?.map(
                ({ version_name, version_code, patch_id, files }: any) => (
                  <TableRow
                    key={JSON.stringify([version_name, version_code, patch_id])}
                    data-testid="build-row"
                    className="font-body"
                  >
                    <TableCell className="w-[60%] align-top">
                      <p className="truncate select-none">
                        {version_name
                          ? version_name + " (" + version_code + ")"
                          : "Patch: " + patch_id}
                      </p>
                      {version_name && patch_id && (
                        <>
                          <div className="py-0.5" />
                          <p className="text-xs truncate text-muted-foreground select-none">
                            {"Patch: " + patch_id}
                          </p>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="w-[40%] align-top">
                      <div className="flex flex-col items-end gap-2">
                        {files?.map((file: any) => (
                          <div
                            key={file.id}
                            className="flex items-center gap-4 py-0.5"
                          >
                            <div className="flex flex-col items-end gap-0.5">
                              <p className="text-xs truncate text-muted-foreground select-none">
                                {file.mapping_type}
                              </p>
                              <p className="text-xs truncate text-muted-foreground select-none">
                                {formatDateToHumanReadableDateTime(
                                  file.last_updated,
                                )}
                              </p>
                            </div>
                            <Button variant="outline" asChild>
                              <a
                                href={`/api${file.download_url}`}
                                download
                                onClick={(e) => {
                                  e.preventDefault();
                                  downloadBuildFile(`/api${file.download_url}`);
                                }}
                              >
                                Download
                              </a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
