"use client";

import { defaultCodeCopySection } from "@/app/components/analytics/trackable_code_block";
import CodeBlock, {
  CODE_FRAME_CLASS,
  CODE_FRAME_HEADER_CLASS,
  CODE_FRAME_PANEL_CLASS,
  CopyCodeButton,
} from "@/app/components/code_block";
import { track } from "@/app/utils/analytics/track";
import { PLAINTEXT_LANGUAGE, resolveLanguage } from "@/app/utils/highlighter";
import { cn } from "@/app/utils/shadcn_utils";
import { accentGreenTextStyle } from "@/app/utils/shared_styles";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

// Tab selections sync across every CodeTabs on the page: picking "Android"
// in one group switches all groups that have an "Android" tab, and the
// choice is remembered for future pages. The selected label lives in
// localStorage (module memory when storage is unavailable) and components
// subscribe to it as an external store.
const SYNC_EVENT = "docs-code-tab-select";
const STORAGE_KEY = "docs-code-tab";

let memoryLabel: string | null = null;

function subscribe(callback: () => void): () => void {
  window.addEventListener(SYNC_EVENT, callback);
  return () => window.removeEventListener(SYNC_EVENT, callback);
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryLabel;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function selectLabel(label: string): void {
  memoryLabel = label;
  try {
    window.localStorage.setItem(STORAGE_KEY, label);
  } catch {
    // Storage can be unavailable (private mode); the module variable still
    // syncs groups within this page.
  }
  window.dispatchEvent(new Event(SYNC_EVENT));
}

export interface CodeTabData {
  label: string;
  code: string;
  className?: string;
}

function parseTabs(tabsJson: string | undefined): CodeTabData[] | null {
  if (!tabsJson) {
    return null;
  }
  try {
    const parsed = JSON.parse(tabsJson);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }
    return parsed.filter(
      (tab): tab is CodeTabData =>
        typeof tab === "object" &&
        tab !== null &&
        typeof tab.label === "string" &&
        typeof tab.code === "string",
    );
  } catch {
    return null;
  }
}

export default function CodeTabs({ tabs: tabsJson }: { tabs?: string }) {
  const [tabs] = useState(() => parseTabs(tabsJson));
  const pathname = usePathname() ?? "";
  const selectedLabel = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (!tabs || tabs.length === 0) {
    return null;
  }

  const syncedIndex =
    selectedLabel === null
      ? -1
      : tabs.findIndex((tab) => tab.label === selectedLabel);
  const active = syncedIndex >= 0 ? syncedIndex : 0;
  const current = tabs[active];
  const currentLanguage =
    resolveLanguage(current.className) ?? PLAINTEXT_LANGUAGE;

  return (
    <div className={cn(CODE_FRAME_CLASS, "mt-5 mb-8")}>
      <div className={CODE_FRAME_HEADER_CLASS}>
        <div role="tablist" className="flex items-center gap-3 overflow-x-auto">
          {tabs.map((tab, index) => (
            <button
              key={tab.label + index}
              type="button"
              role="tab"
              aria-selected={index === active}
              onClick={() => selectLabel(tab.label)}
              className={cn(
                "whitespace-nowrap py-1 font-body text-xs font-medium transition-colors",
                index === active
                  ? accentGreenTextStyle
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <CopyCodeButton
          code={current.code}
          onCopy={() => {
            track("code_copied", {
              source_page: pathname,
              section: defaultCodeCopySection(pathname, currentLanguage),
            });
          }}
        />
      </div>
      {/* All panels render stacked in one grid cell, so the frame always has
          the height of the tallest tab and switching never reflows the page
          (which matters doubly because tab selection syncs page-wide). */}
      <div className={cn(CODE_FRAME_PANEL_CLASS, "grid grid-cols-1")}>
        {tabs.map((tab, index) => (
          <div
            key={tab.label + index}
            className={cn(
              "col-start-1 row-start-1 min-w-0",
              index !== active && "invisible",
            )}
            aria-hidden={index !== active}
          >
            <CodeBlock
              code={tab.code}
              language={resolveLanguage(tab.className) ?? PLAINTEXT_LANGUAGE}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
