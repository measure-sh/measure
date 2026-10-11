"use client";

import type { Funnel } from "@/app/api/api_calls";
import { ApiError } from "@/app/api/api_error";
import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useFilterPage } from "@/app/components/filter_bar/use_filter_page";
import {
  FUNNELS_LIMIT,
  paginationOffsetUrlKey,
  useAuthzAndMembersQuery,
  useFunnelsQuery,
  usePinnedFunnelsQuery,
  useReorderPinnedFunnelsMutation,
  useSetFunnelPinnedMutation,
} from "@/app/query/hooks";
import { track } from "@/app/utils/analytics/track";
import {
  ArrowUpDown,
  Check,
  Funnel as FunnelIcon,
  Plus,
  Search,
  X,
} from "lucide-react";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  formatConversionWindow,
  formatFunnelSteps,
  funnelHref,
} from "./format";
import { Button } from "../button";
import DebounceTextInput from "../debounce_text_input";
import EmptyState from "../empty_state";
import { appPlatform, funnelEventProps } from "./analytics";
import FunnelEditor from "./editor";
import FunnelPinnedCard, { FunnelPinButton } from "./pinned_card";
import FunnelSteps from "./steps";
import LoadingBar from "../loading_bar";
import Paginator from "../paginator";
import RowLinkCell from "../row_link_cell";
import SimpleTooltip from "../simple_tooltip";
import { Skeleton, SkeletonTable } from "../skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";
import { toastNegative } from "../toast";

const searchUrlKey = "q";

export default function FunnelsOverview({ teamId }: { teamId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get(searchUrlKey) ?? "";
  const {
    value,
    apps,
    keys,
    keyGroups,
    keysUnavailable,
    status: filterStatus,
    filterParams,
    paginationOffset,
    onChange,
    nextPage,
    prevPage,
    setPageUrlKey,
  } = useFilterPage({
    teamId,
    entity: "funnels",
    paginationLimit: FUNNELS_LIMIT,
  });
  const readyValue = filterStatus.kind === "ready" ? value : null;
  const funnelsQuery = useFunnelsQuery(
    readyValue?.app.id,
    search,
    paginationOffset,
  );
  const funnels = funnelsQuery.data?.results;
  const pinnedQuery = usePinnedFunnelsQuery(readyValue?.app.id);
  const setFunnelPinned = useSetFunnelPinnedMutation();
  const reorderPinned = useReorderPinnedFunnelsMutation();
  // The order the user is arranging in reorder mode, or null outside it. The
  // draft holds the app it was made for, so after switching apps it is
  // neither shown nor saved for the new app.
  const [reorderDraft, setReorderDraft] = useState<{
    appId: string;
    funnels: Funnel[];
  } | null>(null);
  const reorderFunnels =
    reorderDraft !== null && reorderDraft.appId === readyValue?.app.id
      ? reorderDraft.funnels
      : null;
  const pinned = reorderFunnels ?? pinnedQuery.data?.results;
  const { data: authzAndMembers } = useAuthzAndMembersQuery(teamId);
  const canChangeFunnels = authzAndMembers?.can_change_funnels === true;
  const [editorOpen, setEditorOpen] = useState(false);
  // The app has no funnels at all, as opposed to none matching the search.
  const noFunnels =
    funnels?.length === 0 && search === "" && paginationOffset === 0;

  // DebounceTextInput calls onChange with its initial value once its debounce
  // ends after mount. Resetting the offset on that call would send a user who
  // opened a later page back to the first page.
  const handleSearch = (text: string) => {
    if (text === search) {
      return;
    }
    setPageUrlKey(searchUrlKey, text);
    setPageUrlKey(paginationOffsetUrlKey, "0");
  };

  const pinPending = (funnel: Funnel) =>
    setFunnelPinned.isPending &&
    setFunnelPinned.variables.funnelId === funnel.id;

  const togglePinned = async (funnel: Funnel) => {
    try {
      await setFunnelPinned.mutateAsync({
        appId: funnel.app_id,
        funnelId: funnel.id,
        pinned: !funnel.pinned,
      });
      track(
        funnel.pinned ? "funnel_unpinned" : "funnel_pinned",
        funnelEventProps({
          teamId,
          appId: funnel.app_id,
          platform: appPlatform(apps, funnel.app_id),
        }),
      );
    } catch (error) {
      toastNegative(
        `Error ${funnel.pinned ? "unpinning" : "pinning"} funnel: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const moveInDraft = (index: number, offset: number) => {
    const funnels = [...reorderFunnels!];
    [funnels[index], funnels[index + offset]] = [
      funnels[index + offset],
      funnels[index],
    ];
    setReorderDraft({ appId: reorderDraft!.appId, funnels });
  };

  const saveOrder = async () => {
    const draft = reorderDraft!;
    setReorderDraft(null);
    const unchanged = draft.funnels.every(
      (funnel, i) => funnel.id === pinnedQuery.data?.results[i]?.id,
    );
    if (unchanged) {
      return;
    }
    try {
      await reorderPinned.mutateAsync({
        appId: draft.appId,
        funnels: draft.funnels,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toastNegative(
          "A teammate changed the pinned funnels before your order was saved, please try again",
        );
        return;
      }
      toastNegative(
        `Error reordering pinned funnels: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />

      <div className="flex w-full items-start gap-4">
        <div className="flex-1">
          <FilterBar
            entity="funnels"
            teamId={teamId}
            value={value}
            apps={apps}
            keys={keys}
            keyGroups={keyGroups}
            keysUnavailable={keysUnavailable}
            status={filterStatus}
            showFilterExpr={false}
            showDateRange={false}
            onChange={onChange}
          />
        </div>
        {readyValue !== null && (
          <Button
            variant="outline"
            disabled={!canChangeFunnels}
            onClick={() => setEditorOpen(true)}
          >
            <Plus /> Create Funnel
          </Button>
        )}
      </div>
      <div className="py-4" />

      {filterStatus.kind === "error" && (
        <p className="text-lg font-display">{filterStatus.message}</p>
      )}

      {readyValue !== null && !noFunnels && (
        <>
          <div className="flex w-full items-center justify-between gap-4">
            <p className="font-display text-xl">Pinned Funnels</p>
            {reorderFunnels !== null ? (
              <div className="flex gap-2">
                <SimpleTooltip content="Cancel reorder" align="end">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Cancel reorder"
                    onClick={() => setReorderDraft(null)}
                  >
                    <X />
                  </Button>
                </SimpleTooltip>
                <SimpleTooltip content="Save order" align="end">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Save order"
                    onClick={saveOrder}
                  >
                    <Check />
                  </Button>
                </SimpleTooltip>
              </div>
            ) : (
              (pinnedQuery.data?.results.length ?? 0) > 1 && (
                <SimpleTooltip content="Reorder pinned funnels" align="end">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Reorder pinned funnels"
                    disabled={!canChangeFunnels || pinnedQuery.isFetching}
                    onClick={() =>
                      setReorderDraft({
                        appId: readyValue.app.id,
                        funnels: pinnedQuery.data!.results,
                      })
                    }
                  >
                    <ArrowUpDown />
                  </Button>
                </SimpleTooltip>
              )
            )}
          </div>
          <div className="py-2" />
          {pinnedQuery.isPending && <Skeleton className="w-full h-40" />}
          {pinnedQuery.isError && (
            <p className="text-lg font-display">
              Error fetching pinned funnels, please refresh page to try again
            </p>
          )}
          {pinned?.length === 0 && (
            <p className="w-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground font-body">
              Pin a funnel to see it here
            </p>
          )}
          {pinned && pinned.length > 0 && (
            <div className="flex flex-col w-full gap-4">
              {pinned.map((funnel, i) => (
                <FunnelPinnedCard
                  key={funnel.id}
                  teamId={teamId}
                  funnel={funnel}
                  params={filterParams}
                  reordering={reorderFunnels !== null}
                  isFirst={i === 0}
                  isLast={i === pinned.length - 1}
                  pinDisabled={!canChangeFunnels || pinPending(funnel)}
                  onMoveUp={() => moveInDraft(i, -1)}
                  onMoveDown={() => moveInDraft(i, 1)}
                  onUnpin={() => togglePinned(funnel)}
                />
              ))}
            </div>
          )}
          <div className="py-6" />

          <p className="font-display text-xl">All Funnels</p>
          <div className="py-2" />
          <div className="flex w-full items-center justify-between gap-4">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <DebounceTextInput
                className="pl-8"
                id="funnel-search"
                placeholder="Search funnels..."
                initialValue={search}
                onChange={handleSearch}
              />
            </div>
            <Paginator
              prevEnabled={
                !funnelsQuery.isFetching &&
                (funnelsQuery.data?.meta.previous ?? false)
              }
              nextEnabled={
                !funnelsQuery.isFetching &&
                (funnelsQuery.data?.meta.next ?? false)
              }
              displayText=""
              onNext={nextPage}
              onPrev={prevPage}
            />
          </div>
          <div
            className={`py-1 w-full ${funnelsQuery.isFetching && !funnelsQuery.isPending ? "visible" : "invisible"}`}
          >
            <LoadingBar />
          </div>
          <div className="py-2" />
        </>
      )}

      {(filterStatus.kind === "loading" ||
        (readyValue !== null && funnelsQuery.isPending)) && (
        <SkeletonTable rows={5} columns={5} />
      )}

      {readyValue !== null && funnelsQuery.isError && (
        <p className="text-lg font-display">
          Error fetching list of funnels, please change filters, refresh page or
          select a different app to try again
        </p>
      )}

      {readyValue !== null && funnels?.length === 0 && !noFunnels && (
        <EmptyState
          className="h-144"
          icon={Search}
          title="No funnels match your search"
          description="Try a different name."
        />
      )}

      {readyValue !== null && noFunnels && (
        <EmptyState
          className="h-144"
          icon={FunnelIcon}
          title="No funnels yet"
          description="Create a funnel to see how many users go through a sequence of events."
          action={
            <Button
              variant="outline"
              disabled={!canChangeFunnels}
              onClick={() => setEditorOpen(true)}
            >
              <Plus /> Create Funnel
            </Button>
          }
        />
      )}

      {readyValue !== null && funnels && funnels.length > 0 && (
        <Table className="font-display select-none overflow-hidden">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[25%]">Funnel</TableHead>
              <TableHead className="w-[50%]">Steps</TableHead>
              {/* These short columns take the width of their text, so the
                  text stays on one line. */}
              <TableHead className="w-px whitespace-nowrap text-center">
                Window
              </TableHead>
              <TableHead className="w-[25%] text-center">Created by</TableHead>
              <TableHead className="w-px whitespace-nowrap text-center">
                Updated
              </TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {funnels.map((funnel) => {
              const href = funnelHref(teamId, funnel, "funnels");
              return (
                <TableRow
                  key={funnel.id}
                  className="font-body cursor-pointer"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    // Keys pressed on the pin button reach the row too, and
                    // must not open the funnel.
                    if (e.target !== e.currentTarget) {
                      return;
                    }
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(href);
                    }
                  }}
                >
                  <TableCell className="relative p-0 max-w-0">
                    <SimpleTooltip content={funnel.name}>
                      <Link
                        href={href}
                        className="absolute inset-0 z-10"
                        tabIndex={-1}
                        aria-label={funnel.name}
                      />
                    </SimpleTooltip>
                    <p className="p-4 truncate">{funnel.name}</p>
                  </TableCell>
                  <RowLinkCell
                    href={href}
                    className="max-w-0"
                    tooltip={formatFunnelSteps(funnel)}
                  >
                    <FunnelSteps funnel={funnel} />
                  </RowLinkCell>
                  <RowLinkCell
                    href={href}
                    className="text-center whitespace-nowrap"
                  >
                    {formatConversionWindow(funnel.conversion_window_seconds)}
                  </RowLinkCell>
                  <RowLinkCell href={href} className="text-center max-w-0">
                    <p className="truncate">
                      {funnel.created_by_email ?? "Deleted user"}
                    </p>
                  </RowLinkCell>
                  <RowLinkCell
                    href={href}
                    className="text-center whitespace-nowrap"
                  >
                    {DateTime.fromISO(funnel.updated_at).toRelative()}
                  </RowLinkCell>
                  <TableCell className="w-12 text-center py-0">
                    {/* Pinning or unpinning is disallowed during reorder. */}
                    <FunnelPinButton
                      pinned={funnel.pinned}
                      disabled={
                        !canChangeFunnels ||
                        pinPending(funnel) ||
                        reorderFunnels !== null
                      }
                      onClick={() => togglePinned(funnel)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {readyValue !== null && (
        <FunnelEditor
          appId={readyValue.app.id}
          funnel={null}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          onSaved={(funnel) => {
            track(
              "funnel_created",
              funnelEventProps({
                teamId,
                appId: funnel.app_id,
                platform: appPlatform(apps, funnel.app_id),
              }),
            );
            router.push(funnelHref(teamId, funnel, "created"));
          }}
        />
      )}
    </div>
  );
}
