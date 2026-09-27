"use client";

import type {
  App,
  JourneyMap as JourneyMapData,
  JourneyMapScreen,
} from "@/app/api/api_calls";
import EmptyState from "@/app/components/empty_state";
import AppSelect from "@/app/components/filter_bar/app_select";
import { resolveApp } from "@/app/components/filter_bar/resolve_filters";
import Onboarding from "@/app/components/onboarding";
import { Skeleton } from "@/app/components/skeleton";
import { useAppsQuery, useJourneyMapQuery } from "@/app/query/hooks";
import { useFiltersStore } from "@/app/stores/provider";
import { Map as MapIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { screenTitle } from "./format";
import JourneyMapCanvas, {
  type JourneyMapCanvasHandle,
} from "./journey_map_canvas";
import JourneyMapPanel from "./journey_map_panel";
import { layoutJourneyMap, thumbWidth } from "./layout";
import { NoSnapshot, Wireframe } from "./wireframe";

function SectionHeading({
  title,
  caption,
}: {
  title: string;
  caption: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="font-body text-sm text-muted-foreground">{caption}</p>
    </div>
  );
}

function ScreenTile({
  screen,
  thumbAspect,
  onSelect,
}: {
  screen: JourneyMapScreen;
  thumbAspect: number;
  onSelect: (key: string) => void;
}) {
  const variant = screen.variants[0];
  return (
    <button
      type="button"
      onClick={() => onSelect(screen.key)}
      className="group flex flex-col rounded-lg border bg-card p-2 text-left transition-colors hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
    >
      <div
        className="relative w-full overflow-hidden rounded-md bg-muted/50"
        style={{ aspectRatio: `1 / ${thumbAspect}` }}
      >
        {variant ? (
          <Wireframe
            wireframe={variant.wireframe}
            crop
            className="h-full w-full"
          />
        ) : (
          <NoSnapshot className="h-full w-full" />
        )}
        {screen.variants.length > 1 && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-foreground px-1.5 py-px font-body text-[10px] text-background">
            {screen.variants.length} states
          </span>
        )}
      </div>
      <p className="mt-2 truncate font-display text-sm">
        {screenTitle(screen)}
      </p>
      <p className="truncate font-body text-xs text-muted-foreground">
        {screen.screen ? screen.host : " "}
      </p>
    </button>
  );
}

function ScreensGrid({
  map,
  thumbAspect,
  onSelect,
}: {
  map: JourneyMapData;
  thumbAspect: number;
  onSelect: (key: string) => void;
}) {
  return (
    <section className="w-full">
      <SectionHeading
        title="Screens"
        caption="Every screen users saw, most visited first"
      />
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {map.screens.map((s) => (
          <ScreenTile
            key={s.key}
            screen={s}
            thumbAspect={thumbAspect}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function JourneyMapContent({ map }: { map: JourneyMapData }) {
  const layout = useMemo(() => layoutJourneyMap(map), [map]);
  const canvasRef = useRef<JourneyMapCanvasHandle>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // The panel keeps showing the last screen while it slides closed.
  const [panelScreen, setPanelScreen] = useState<JourneyMapScreen | null>(null);

  const screens = useMemo(
    () => Object.fromEntries(map.screens.map((s) => [s.key, s])),
    [map],
  );

  const select = (key: string | null) => {
    setSelected(key);
    if (key && screens[key]) {
      setPanelScreen(screens[key]);
    }
  };

  // Picking a screen in the grid below scrolls up to it on the map.
  const showOnMap = (key: string) => {
    select(key);
    canvasRef.current?.focus(key);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  if (map.screens.length === 0) {
    return (
      <EmptyState
        icon={MapIcon}
        title="No screens to map yet"
        description="Screens show up once sessions capture layout snapshots"
        className="h-144"
      />
    );
  }

  return (
    <div className="flex w-full flex-col items-start">
      <div ref={mapRef} className="w-full">
        <JourneyMapCanvas
          ref={canvasRef}
          map={map}
          layout={layout}
          selected={selected}
          panelOpen={selected !== null}
          onSelect={select}
        >
          <JourneyMapPanel
            screen={panelScreen}
            open={selected !== null}
            onClose={() => setSelected(null)}
          />
        </JourneyMapCanvas>
      </div>
      <div className="py-8" />
      <ScreensGrid
        map={map}
        thumbAspect={layout.thumbHeight / thumbWidth}
        onSelect={showOnMap}
      />
    </div>
  );
}

const noApps: App[] = [];

export default function JourneyMap({ params }: { params: { teamId: string } }) {
  const { teamId } = params;
  const rememberedAppId = useFiltersStore((state) => state.selectedApp?.id);
  const setSelectedApp = useFiltersStore((state) => state.setSelectedApp);
  const appsQuery = useAppsQuery(teamId);
  const apps = appsQuery.data ?? noApps;
  // Use the app remembered from other pages, else the first in the list
  const app = resolveApp(null, appsQuery.data, rememberedAppId);
  const appId = app?.id;
  const { data, status } = useJourneyMapQuery(appId);

  return (
    <div className="flex flex-col items-start">
      <div className="py-4" />
      {appsQuery.isPending && <Skeleton className="h-9 w-48" />}
      {appsQuery.isError && (
        <p className="font-display text-lg">
          Error fetching apps. Please refresh the page to try again.
        </p>
      )}
      {appsQuery.isSuccess && apps.length === 0 && (
        <Onboarding teamId={teamId} />
      )}
      {app !== null && (
        <AppSelect apps={apps} selected={app} onChange={setSelectedApp} />
      )}
      <div className="py-4" />

      {appId && status === "pending" && (
        <Skeleton className="h-[72vh] min-h-135 w-full" />
      )}

      {appId && status === "error" && (
        <p className="font-display text-lg">
          Error fetching journey map. Please refresh the page to try again.
        </p>
      )}

      {appId && status === "success" && data && (
        <JourneyMapContent key={appId} map={data} />
      )}
    </div>
  );
}
