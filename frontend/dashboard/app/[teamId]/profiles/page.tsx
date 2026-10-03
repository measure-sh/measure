"use client";

import { emptyProfilesResponse, Profile } from "@/app/api/api_calls";
import { Button } from "@/app/components/button";
import EmptyState from "@/app/components/empty_state";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useFilterPage } from "@/app/components/filter_bar/use_filter_page";
import LoadingBar from "@/app/components/loading_bar";
import Paginator from "@/app/components/paginator";
import Pill from "@/app/components/pill";
import { SkeletonListPage } from "@/app/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/table";
import { toastNegative } from "@/app/components/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/app/components/tooltip";
import { PROFILES_LIMIT, useProfilesQuery } from "@/app/query/hooks";
import { openTraceInPerfetto } from "@/app/utils/perfetto_utils";
import { underlineLinkStyle } from "@/app/utils/shared_styles";
import {
  formatDateToHumanReadableDate,
  formatDateToHumanReadableTime,
} from "@/app/utils/time_utils";
import { Download, ExternalLink, Flame, Video } from "lucide-react";
import Link from "next/link";
import { use, type ReactElement } from "react";

const triggerLabels: Record<string, string> = {
  anr: "ANR",
  app_fully_drawn: "App fully drawn",
  oom: "Out of Memory",
  cold_start: "Cold start",
  kill_excessive_cpu_usage: "Excessive CPU usage",
};

const formatLabels: Record<string, string> = {
  perfetto_trace: "Perfetto trace",
  perfetto_java_heap_dump: "Perfetto Java heap dump",
  perfetto_heap_profile: "Perfetto heap profile",
  perfetto_stack_sample: "Perfetto stack sample",
};

function formatProfileDetails(profile: Profile) {
  const { attribute } = profile;
  const device = [attribute.device_manufacturer, attribute.device_model]
    .filter(Boolean)
    .join(" ")
    .trim();
  return [
    `${attribute.app_version} (${attribute.app_build})`,
    `${attribute.os_name} ${attribute.os_version}`.trim(),
    device,
  ]
    .filter(Boolean)
    .join(", ");
}

function IconAction({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="font-body text-sm">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ProfileActions({
  teamId,
  profile,
}: {
  teamId: string;
  profile: Profile;
}) {
  const attachment = profile.attachments[0];
  const sessionHref = `/${teamId}/session_replays/${profile.app_id}/${profile.session_id}`;

  return (
    <div className="flex items-center justify-center gap-2 p-4">
      <IconAction label="Open in Perfetto">
        <Button
          variant="outline"
          size="icon"
          disabled={!attachment}
          aria-label="Open in Perfetto"
          onClick={() =>
            openTraceInPerfetto(attachment.location, attachment.name).catch(
              (error) =>
                toastNegative(
                  "Failed to open profile in Perfetto",
                  error instanceof Error ? error.message : String(error),
                ),
            )
          }
        >
          <ExternalLink />
        </Button>
      </IconAction>
      <IconAction label="View session replay">
        <Button variant="outline" size="icon" asChild>
          <Link href={sessionHref} aria-label="View session replay">
            <Video />
          </Link>
        </Button>
      </IconAction>
      <IconAction label="Download">
        <Button variant="outline" size="icon" asChild>
          <a
            href={attachment?.location}
            download={attachment?.name}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download"
          >
            <Download />
          </a>
        </Button>
      </IconAction>
    </div>
  );
}

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function ProfilesPage({ params }: PageProps) {
  const { teamId } = use(params);
  const filter = useFilterPage({
    teamId,
    entity: "profiles",
    paginationLimit: PROFILES_LIMIT,
  });
  const readyValue = filter.status.kind === "ready" ? filter.value : null;

  const {
    data: profiles = emptyProfilesResponse,
    status,
    isFetching,
  } = useProfilesQuery(filter.filterParams, filter.paginationOffset);
  const listEmpty =
    status === "success" &&
    filter.paginationOffset === 0 &&
    (profiles.results?.length ?? 0) === 0;

  return (
    <div className="flex flex-col items-start w-full">
      <div className="py-4" />
      <FilterBar
        teamId={teamId}
        status={filter.status}
        entity="profiles"
        placeholder="Filter by profile trigger, app version or device…"
        value={filter.value}
        apps={filter.apps}
        keys={filter.keys}
        keyGroups={filter.keyGroups}
        keysUnavailable={filter.keysUnavailable}
        onChange={filter.onChange}
      />
      <div className="py-4" />

      {filter.status.kind === "error" && (
        <p className="text-lg font-display">{filter.status.message}</p>
      )}

      {filter.status.kind === "loading" && (
        <SkeletonListPage showPlot={false} tableColumns={3} />
      )}

      {readyValue !== null && status === "error" && (
        <p className="text-lg font-display">
          Error fetching list of profiles, please change filters, refresh page
          or select a different app to try again
        </p>
      )}

      {readyValue !== null && listEmpty && (
        <EmptyState
          icon={Flame}
          title="No profiles found"
          description="Try a wider time range or different filters"
          className="h-144"
          action={
            <p className="text-xs text-muted-foreground">
              Profiles are captured on Android 16 and above once profiling is
              enabled in your app.{" "}
              <Link
                href="/docs/performance-tracing/profiling"
                className={underlineLinkStyle}
              >
                Learn more
              </Link>
            </p>
          }
        />
      )}

      {readyValue !== null && status !== "error" && !listEmpty && (
        <div className="flex flex-col items-center w-full">
          <div className="self-end">
            <Paginator
              prevEnabled={isFetching ? false : profiles.meta.previous}
              nextEnabled={isFetching ? false : profiles.meta.next}
              displayText=""
              onNext={filter.nextPage}
              onPrev={filter.prevPage}
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
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50%]">Profile Trigger</TableHead>
                <TableHead className="w-[15%] text-center">Type</TableHead>
                <TableHead className="w-[15%] text-center">Time</TableHead>
                <TableHead className="w-[20%] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.results?.map((profile) => (
                <TableRow
                  key={profile.id}
                  className="font-body hover:bg-transparent"
                >
                  <TableCell className="w-[50%] p-0">
                    <div className="p-4">
                      <p className="truncate">
                        {triggerLabels[profile.trigger] ?? profile.trigger}
                      </p>
                      <div className="py-1" />
                      <p className="truncate text-xs text-muted-foreground">
                        {formatProfileDetails(profile)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="w-[15%] p-0 text-center">
                    <div className="p-4">
                      <Pill>
                        {formatLabels[profile.format] ?? profile.format}
                      </Pill>
                    </div>
                  </TableCell>
                  <TableCell className="w-[15%] p-0 text-center">
                    <div className="p-4">
                      <p className="truncate">
                        {formatDateToHumanReadableDate(profile.timestamp)}
                      </p>
                      <div className="py-1" />
                      <p className="text-xs truncate">
                        {formatDateToHumanReadableTime(profile.timestamp)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="w-[20%] p-0">
                    <ProfileActions teamId={teamId} profile={profile} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
