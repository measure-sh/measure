"use client";

import type { JourneyMapScreen } from "@/app/api/api_calls";
import { cn } from "@/app/utils/shadcn_utils";
import { X } from "lucide-react";
import { useState } from "react";
import { screenTitle, variantHint } from "./format";
import { panelWidth } from "./journey_map_canvas";
import { NoSnapshot, Wireframe } from "./wireframe";

function PanelBody({ screen }: { screen: JourneyMapScreen }) {
  const [variantIndex, setVariantIndex] = useState(0);
  const variant = screen.variants[variantIndex];
  const visitsWithSnapshot = Math.max(1, screen.snapshot_visits);

  return (
    <>
      <div className="flex justify-center bg-muted/40 px-4 py-5">
        <div className="w-52 overflow-hidden rounded-md border bg-background shadow-sm">
          {variant ? (
            <Wireframe
              wireframe={variant.wireframe}
              className="h-auto w-full"
            />
          ) : (
            <NoSnapshot className="aspect-9/16 w-full" />
          )}
        </div>
      </div>

      {screen.variants.length > 1 && (
        <section className="border-t px-4 py-4">
          <h3 className="mb-2 font-display text-xs uppercase tracking-wide text-muted-foreground">
            {screen.variants.length} states
          </h3>
          <div className="-mx-1 flex flex-row gap-2 overflow-x-auto px-1 pb-1">
            {screen.variants.map((v, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setVariantIndex(i)}
                className={cn(
                  "w-20 shrink-0 rounded-md border p-1 text-left transition-colors hover:border-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none",
                  i === variantIndex && "border-primary ring-1 ring-primary/40",
                )}
              >
                <div className="h-28 overflow-hidden rounded-sm bg-muted/50">
                  <Wireframe
                    wireframe={v.wireframe}
                    crop
                    className="h-full w-full"
                  />
                </div>
                <p className="mt-1 font-code text-[11px]">
                  {Math.round((100 * v.visits) / visitsWithSnapshot)}%
                </p>
                <p className="line-clamp-2 font-body text-[10px] leading-3 text-muted-foreground">
                  {variantHint(v)}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default function JourneyMapPanel({
  screen,
  open,
  onClose,
}: {
  screen: JourneyMapScreen | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <aside
      aria-hidden={!open}
      className={cn(
        "absolute right-0 top-0 flex h-full max-w-[90%] flex-col border-l bg-card text-card-foreground shadow-xl transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "pointer-events-none translate-x-full",
      )}
      style={{ width: panelWidth }}
    >
      {screen && (
        <>
          <div className="flex flex-row items-start justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate font-display text-base">
                {screenTitle(screen)}
              </h2>
              {screen.screen && (
                <p className="truncate font-body text-xs text-muted-foreground">
                  {screen.host}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-sm p-1 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Keyed on the screen so switching screens starts on its first state. */}
            <PanelBody key={screen.key} screen={screen} />
          </div>
        </>
      )}
    </aside>
  );
}
