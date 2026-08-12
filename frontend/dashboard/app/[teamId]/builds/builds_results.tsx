"use client";

import {
  type Build,
  type BuildFile,
  downloadBuildFile,
  emptyBuildsResponse,
} from "@/app/api/api_calls";
import { Button } from "@/app/components/button";
import type { FilterState } from "@/app/components/filter_bar/filter_bar";
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
import type { useBuildsQuery } from "@/app/query/hooks";
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils";

export default function BuildsResults({
  filterState,
  query,
  filterExprHasIssues,
  onNextPage,
  onPrevPage,
}: {
  filterState: FilterState;
  query: ReturnType<typeof useBuildsQuery>;
  filterExprHasIssues: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
}) {
  const builds = query.data ?? emptyBuildsResponse;

  return (
    <>
      {filterState.status === "error" && (
        <p className="text-lg font-display">{filterState.message}</p>
      )}

      {filterState.status !== "error" && query.status === "pending" && (
        <SkeletonListPage />
      )}

      {query.status === "error" && !filterExprHasIssues && (
        <p className="text-lg font-display">
          Error fetching list of builds, please change filters, refresh page or
          select a different app to try again
        </p>
      )}

      {query.status === "success" && (
        <div className="flex flex-col items-center w-full">
          <div className="self-end">
            <Paginator
              prevEnabled={query.isFetching ? false : builds.meta.previous}
              nextEnabled={query.isFetching ? false : builds.meta.next}
              displayText=""
              onNext={onNextPage}
              onPrev={onPrevPage}
            />
          </div>
          <div
            className={`py-1 w-full ${query.isFetching ? "visible" : "invisible"}`}
          >
            <LoadingBar />
          </div>
          <div className="py-4" />
          <BuildsTable builds={builds.results} />
        </div>
      )}
    </>
  );
}

function BuildsTable({ builds }: { builds: Build[] }) {
  return (
    <Table className="font-display select-none">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60%]">Build</TableHead>
          <TableHead className="w-[40%] text-right">Files</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {builds?.map((build) => (
          <BuildRow key={buildKey(build)} build={build} />
        ))}
      </TableBody>
    </Table>
  );
}

function BuildRow({ build }: { build: Build }) {
  const { title, subtitle } = describeBuild(build);

  return (
    <TableRow data-testid="build-row" className="font-body">
      <TableCell className="w-[60%] align-top">
        <p className="truncate select-none">{title}</p>
        {subtitle && (
          <>
            <div className="py-0.5" />
            <p className="text-xs truncate text-muted-foreground select-none">
              {subtitle}
            </p>
          </>
        )}
      </TableCell>
      <TableCell className="w-[40%] align-top">
        <div className="flex flex-col items-end gap-2">
          {build.files?.map((file) => (
            <FileRow key={file.id} file={file} />
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

function FileRow({ file }: { file: BuildFile }) {
  const url = `/api${file.download_url}`;

  return (
    <div className="flex items-center gap-4 py-0.5">
      <div className="flex flex-col items-end gap-0.5">
        <p className="text-xs truncate text-muted-foreground select-none">
          {file.mapping_type}
        </p>
        <p className="text-xs truncate text-muted-foreground select-none">
          {formatDateToHumanReadableDateTime(file.last_updated)}
        </p>
      </div>
      <Button variant="outline" asChild>
        <a
          href={url}
          download
          onClick={(e) => {
            e.preventDefault();
            downloadBuildFile(url);
          }}
        >
          Download
        </a>
      </Button>
    </div>
  );
}

// A build has no id of its own: it is an app version, an Over-The-Air patch,
// or a patch against a version, so those three fields together identify it.
function buildKey(build: Build): string {
  return JSON.stringify([
    build.version_name,
    build.version_code,
    build.patch_id,
  ]);
}

// An Over-The-Air patch has no app version, so the title falls back to the
// patch version, and then to the patch id.
function describeBuild(build: Build): {
  title: string;
  subtitle: string | null;
} {
  if (build.version_name) {
    return {
      title: `${build.version_name} (${build.version_code})`,
      subtitle: null,
    };
  }
  if (build.patch_version) {
    return {
      title: `patch_version: ${build.patch_version}`,
      subtitle: `patch_id: ${build.patch_id}`,
    };
  }
  return { title: `patch_id: ${build.patch_id}`, subtitle: null };
}
