"use client";

import FilterBar from "@/app/components/filter_bar/filter_bar";
import { useFilterPage } from "@/app/components/filter_bar/use_filter_page";
import { use } from "react";

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function MemoryPage({ params }: PageProps) {
  const { teamId } = use(params);
  const filter = useFilterPage({ teamId, entity: "sessions" });

  return (
    <div className="flex flex-col items-start w-full">
      <div className="py-4" />
      <FilterBar
        teamId={teamId}
        status={filter.status}
        entity="sessions"
        placeholder="Filter sessions…"
        value={filter.value}
        apps={filter.apps}
        keys={filter.keys}
        keyGroups={filter.keyGroups}
        keysUnavailable={filter.keysUnavailable}
        onChange={filter.onChange}
      />
    </div>
  );
}
