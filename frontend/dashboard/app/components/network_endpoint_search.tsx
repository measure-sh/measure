"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/app/components/command";
import { Input } from "@/app/components/input";
import { useNetworkEndpointsQuery } from "@/app/query/hooks";
import {
  addRecentSearch,
  getRecentSearches,
  removeRecentSearch,
  type RecentSearchEntry,
} from "@/app/utils/network_recent_searches";
import { cn } from "@/app/utils/shadcn_utils";
import { Command as CommandPrimitive } from "cmdk";
import { History, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const MAX_VISIBLE_RECENT_SEARCHES = 3;

function splitEndpoint(endpoint: string): { domain: string; path: string } {
  const slash = endpoint.indexOf("/");
  if (slash === -1) {
    return { domain: endpoint, path: "" };
  }
  return { domain: endpoint.slice(0, slash), path: endpoint.slice(slash) };
}

function normalizeEndpointSearch(endpoint: string): string {
  const search = endpoint.trim();
  if (search.startsWith("/") || !search.includes("/")) {
    return search;
  }

  const slash = search.indexOf("/");
  const prefix = search.slice(0, slash);
  if (prefix.includes(".") || prefix.includes(":") || prefix === "localhost") {
    return search;
  }

  return `/${search}`;
}

interface NetworkEndpointSearchProps {
  teamId: string;
}

export default function NetworkEndpointSearch({
  teamId,
}: NetworkEndpointSearchProps) {
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [recentEndpoints, setRecentEndpoints] = useState<RecentSearchEntry[]>(
    () => getRecentSearches(teamId),
  );

  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const normalizedDebouncedQuery = normalizeEndpointSearch(debouncedQuery);
  const endpointsQuery = useNetworkEndpointsQuery(
    normalizedDebouncedQuery,
    open,
  );
  const trimmed = query.trim();
  const isWildcardSearch = trimmed.includes("*");
  const isWaitingForCurrentQuery =
    query !== debouncedQuery || endpointsQuery.isFetching;
  const endpoints = isWaitingForCurrentQuery ? [] : (endpointsQuery.data ?? []);
  const matchingRecentEndpoints = useMemo(() => {
    const normalizedQuery = normalizeEndpointSearch(trimmed).toLowerCase();
    return recentEndpoints
      .filter(({ domain, path }) => {
        const endpoint = `${domain}${path}`;
        return endpoint.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, MAX_VISIBLE_RECENT_SEARCHES);
  }, [recentEndpoints, trimmed]);

  const applySelection = (
    domain: string,
    path: string,
    endpointSelection: string,
  ) => {
    if (endpointSelection === "") {
      setOpen(false);
      return;
    }

    addRecentSearch(teamId, domain, path);
    setRecentEndpoints(getRecentSearches(teamId));

    const params = new URLSearchParams(currentSearchParams.toString());
    params.set("domain", domain);
    params.set("path", path);
    params.set("from", "search");

    // cmdk invokes keyboard selection through a native event. Update the
    // controlled input before navigation so both keyboard and pointer
    // selections visibly commit the endpoint.
    setQuery(endpointSelection);
    setOpen(false);
    router.push(`/${teamId}/network/details?${params.toString()}`);
  };

  const apply = (endpoint: string) => {
    const endpointSelection = normalizeEndpointSearch(endpoint);
    const { domain, path } = splitEndpoint(endpointSelection);
    applySelection(domain, path, endpointSelection);
  };

  const removeRecent = (entry: RecentSearchEntry) => {
    removeRecentSearch(teamId, entry.domain, entry.path);
    setRecentEndpoints(getRecentSearches(teamId));
  };

  const recentEndpointSet = new Set(
    matchingRecentEndpoints.map(({ domain, path }) => `${domain}${path}`),
  );

  const endpointItems = endpoints
    .filter(
      ({ domain, path_pattern }) =>
        !recentEndpointSet.has(`${domain}${path_pattern}`),
    )
    .map(({ domain, path_pattern }) => (
      <CommandItem
        key={`${domain}${path_pattern}`}
        value={`${domain}${path_pattern}`}
        data-testid="network-endpoint-suggestion"
        onSelect={() =>
          applySelection(domain, path_pattern, `${domain}${path_pattern}`)
        }
        className="font-mono cursor-pointer"
      >
        {domain}
        {path_pattern}
      </CommandItem>
    ));
  const explorePatternItem =
    isWildcardSearch && endpoints.length > 0 ? (
      <CommandItem
        key="explore-pattern"
        value={`Explore pattern ${trimmed}`}
        data-testid="network-endpoint-explore-pattern"
        onSelect={() => apply(trimmed)}
        className="font-mono cursor-pointer"
      >
        <span className="font-body">Explore pattern</span>
        <span className="min-w-0 flex-1 truncate">{trimmed}</span>
      </CommandItem>
    ) : null;

  const recentItems = matchingRecentEndpoints.map(({ domain, path }) => {
    const endpoint = `${domain}${path}`;
    return (
      <CommandItem
        key={`recent-${endpoint}`}
        value={endpoint}
        data-testid="network-recent-endpoint"
        onSelect={() => applySelection(domain, path, endpoint)}
        className="font-mono cursor-pointer"
      >
        <History className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{endpoint}</span>
        <button
          type="button"
          aria-label={`Remove ${endpoint} from recent searches`}
          data-testid="network-recent-endpoint-remove"
          className="cursor-pointer p-1 text-muted-foreground hover:text-foreground"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            removeRecent({ domain, path });
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </CommandItem>
    );
  });

  const hasDropdownItems =
    explorePatternItem !== null ||
    endpointItems.length > 0 ||
    recentItems.length > 0;
  const shouldShowDropdown =
    open &&
    !isWaitingForCurrentQuery &&
    (endpointsQuery.isError || hasDropdownItems);

  return (
    <div className="relative w-full">
      <Command
        shouldFilter={false}
        loop
        className="overflow-visible rounded-md bg-transparent"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          // Enter must only select an actual visible target. Plain text never
          // becomes a chart scope on its own.
          if (event.key === "Enter" && !hasDropdownItems) {
            event.preventDefault();
            if (query.trim() === "") {
              setOpen(false);
            }
          }
        }}
      >
        <CommandPrimitive.Input
          asChild
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        >
          <Input
            data-testid="network-endpoint-search"
            placeholder="Search endpoints, e.g. /v1/products/*, /v1/**, api.example.com/v1/orders/**"
            className="font-body"
          />
        </CommandPrimitive.Input>

        {shouldShowDropdown && (
          <CommandList
            data-testid="network-endpoint-dropdown"
            className="absolute top-full right-0 left-0 z-50 mt-1 rounded-md border border-border bg-popover p-1 shadow-lg"
            onMouseDown={(event) => event.preventDefault()}
          >
            {endpointsQuery.isError ? (
              <CommandEmpty data-testid="network-endpoint-error">
                Unable to load endpoints. Try again.
              </CommandEmpty>
            ) : (
              <>
                {recentItems.length > 0 && (
                  <CommandGroup>{recentItems}</CommandGroup>
                )}
                {explorePatternItem}
                {endpointItems}
              </>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}
