"use client";

import { AlertTriangle, CheckCircle } from "lucide-react";
import React, { useState } from "react";
import type {
  MemoryScope,
  MemoryThresholdEntry,
  MemoryUsageSummaryRow,
} from "../api/api_calls";
import { Card, CardContent, CardFooter } from "./card";
import SimpleTooltip from "./simple_tooltip";
import TabSelect from "./tab_select";

interface MemoryUsageSummaryCardsProps {
  data: MemoryUsageSummaryRow[];
  // e.g. "Dynamic Memory Usage" (Android) or "Memory Footprint" (iOS) — the
  // card title on iOS, which has no process-state concept to label with.
  metricLabel: string;
  // Google Play's own "excessive memory usage" ceiling, one entry per
  // process state Play publishes a number for. A card whose process state
  // has no matching entry (no RAM tier filtered, or iOS) renders with no
  // status badge — never guessed client-side.
  thresholds?: MemoryThresholdEntry[];
}

// Mirrors metrics_card.tsx's own style constants for visual consistency
// between the two card families, which don't share an implementation: this
// card's data shape (a per-process-state distribution + session count
// against a fixed Play ceiling) and metrics_card.tsx's (a single scalar +
// version comparison against a user-configurable threshold) are different
// enough that forcing this into MetricsCardProps would be more contortion
// than reuse.
const STYLES = {
  icon: {
    status: "w-5 h-5",
    tooltipIcon: "w-4 h-4",
    green: "text-green-600 dark:text-green-400",
    yellow: "text-yellow-600 dark:text-yellow-400",
    red: "text-red-600 dark:text-red-400",
  },
  text: {
    mainValue: "font-code font-semibold text-3xl",
    subtitle: "font-code text-sm text-muted-foreground",
    footerTitle: "font-display text-sm select-none",
    tooltipContent: "p-2",
  },
  layout: {
    cardSize: "w-full md:w-[300px] h-fit",
    cardContent: "p-4 h-[100px] relative",
    cardFooter: "p-4 flex flex-col items-start gap-1",
    contentFlex: "flex flex-col h-full justify-center",
    statusIconPosition: "absolute top-2 right-2",
    spacer: "py-1",
    tooltipIconRow: "flex items-center gap-2 mt-2",
    tooltipIconRowSmall: "flex items-center gap-2 mt-1",
  },
} as const;

const PROCESS_STATE_LABEL: Record<MemoryScope, string> = {
  foreground: "Foreground",
  user_perceived_service: "User-perceived service",
  background: "Background",
};

enum Quantile {
  p50 = "p50",
  p90 = "p90",
  p95 = "p95",
}

// The status badge always reflects p90-vs-threshold regardless of which
// quantile tab is currently on display: Play's own ceiling is itself a
// p90-of-sessions metric, so badging it off p50/p95 would compare two
// different things and could read as misleadingly lenient.
type Band = "good" | "caution" | "poor";

function bandFor(p90mb: number, thresholdMB: number): Band {
  if (p90mb < 0.8 * thresholdMB) return "good";
  if (p90mb < thresholdMB) return "caution";
  return "poor";
}

function StatusIcon({ band }: { band: Band }) {
  const className = `${STYLES.icon.status} ${
    band === "good"
      ? STYLES.icon.green
      : band === "caution"
        ? STYLES.icon.yellow
        : STYLES.icon.red
  }`;
  return band === "good" ? (
    <CheckCircle className={className} />
  ) : (
    <AlertTriangle className={className} />
  );
}

function StatusIconRow({
  band,
  text,
  first = false,
}: {
  band: Band;
  text: string;
  first?: boolean;
}) {
  const colorClass =
    band === "good"
      ? STYLES.icon.green
      : band === "caution"
        ? STYLES.icon.yellow
        : STYLES.icon.red;
  return (
    <span
      className={
        first ? STYLES.layout.tooltipIconRow : STYLES.layout.tooltipIconRowSmall
      }
    >
      {band === "good" ? (
        <CheckCircle className={`${STYLES.icon.tooltipIcon} ${colorClass}`} />
      ) : (
        <AlertTriangle className={`${STYLES.icon.tooltipIcon} ${colorClass}`} />
      )}{" "}
      <span>{text}</span>
    </span>
  );
}

function thresholdTooltip(threshold: MemoryThresholdEntry) {
  return (
    <div className={STYLES.text.tooltipContent}>
      <p>{threshold.label}</p>
      <br />
      <StatusIconRow
        first
        band="good"
        text={`Good (< 80% of ${threshold.mb} MB)`}
      />
      <StatusIconRow
        band="caution"
        text={`Caution (80–100% of ${threshold.mb} MB)`}
      />
      <StatusIconRow band="poor" text={`Poor (≥ ${threshold.mb} MB)`} />
    </div>
  );
}

const MemoryUsageSummaryCards: React.FC<MemoryUsageSummaryCardsProps> = ({
  data,
  metricLabel,
  thresholds,
}) => {
  const [quantile, setQuantile] = useState(Quantile.p90);

  if (!data || data.length === 0) {
    return (
      <div className="flex font-body items-center justify-center w-full h-64">
        <p className="text-lg font-display text-center p-4">No Data</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-4">
      <div className="flex w-full justify-end">
        <TabSelect
          items={Object.values(Quantile)}
          selected={quantile}
          onChangeSelected={(item) => setQuantile(item as Quantile)}
        />
      </div>
      <div className="flex flex-wrap gap-4 w-full">
        {data.map((row) => {
          const title = row.process_state
            ? PROCESS_STATE_LABEL[row.process_state]
            : metricLabel;
          const valueMB = row[quantile] / 1024;
          const threshold = row.process_state
            ? thresholds?.find((t) => t.process_state === row.process_state)
            : undefined;
          const band = threshold
            ? bandFor(row.p90 / 1024, threshold.mb)
            : undefined;

          return (
            <SimpleTooltip
              key={row.process_state ?? title}
              triggerClassName="transition-all"
              content={threshold ? thresholdTooltip(threshold) : null}
            >
              <Card
                data-testid="memory-summary-card"
                data-process-state={row.process_state ?? ""}
                className={`${STYLES.layout.cardSize} bg-card text-card-foreground hover:bg-muted/50 dark:hover:bg-card/50`}
              >
                <CardContent className={STYLES.layout.cardContent}>
                  {band && (
                    <div
                      className={STYLES.layout.statusIconPosition}
                      data-testid="memory-summary-status-icon"
                      data-band={band}
                    >
                      <StatusIcon band={band} />
                    </div>
                  )}
                  <div className={STYLES.layout.contentFlex}>
                    <p className={STYLES.text.mainValue}>
                      {valueMB.toFixed(0)} MB
                    </p>
                    <div className={STYLES.layout.spacer} />
                    <p className={STYLES.text.subtitle}>
                      {row.sessions.toLocaleString()} sessions
                    </p>
                  </div>
                </CardContent>
                <CardFooter className={STYLES.layout.cardFooter}>
                  <p className={STYLES.text.footerTitle}>{title}</p>
                  {threshold && (
                    <p className="font-code text-xs text-muted-foreground">
                      {threshold.label}: {threshold.mb} MB
                    </p>
                  )}
                </CardFooter>
              </Card>
            </SimpleTooltip>
          );
        })}
      </div>
    </div>
  );
};

export default MemoryUsageSummaryCards;
