"use client";

import NetworkDetails from "@/app/components/network_details";
import { track } from "@/app/utils/analytics/track";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useRef } from "react";

export default function NetworkDetailsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const domain = searchParams.get("domain") ?? "";
  const path = searchParams.get("path") ?? "";
  const entryPoint = searchParams.get("from") ?? "direct";
  const search = searchParams.toString();

  useEffect(() => {
    if (domain !== "" || path !== "") {
      return;
    }

    const query = new URLSearchParams(search);
    query.delete("domain");
    query.delete("path");
    query.delete("from");
    const suffix = query.toString();
    router.replace(
      `/${resolvedParams.teamId}/network${suffix === "" ? "" : `?${suffix}`}`,
    );
  }, [domain, resolvedParams.teamId, router, search]);

  // Fire `network_call_inspected` once per endpoint. The ref covers
  // within-route navigation (endpoint A -> endpoint B without remount) and
  // NetworkDetails URL rewrites, which omit `from` but are not new inspections.
  const inspectedEndpointRef = useRef<string | null>(null);
  useEffect(() => {
    if (domain === "" && path === "") {
      return;
    }

    const endpoint = JSON.stringify([domain, path]);
    if (inspectedEndpointRef.current === endpoint) {
      return;
    }
    inspectedEndpointRef.current = endpoint;

    track("network_call_inspected", {
      team_id: resolvedParams.teamId,
      feature_area: "network",
      entry_point: entryPoint,
    });
  }, [domain, entryPoint, path, resolvedParams.teamId]);

  if (domain === "" && path === "") {
    return null;
  }

  return <NetworkDetails params={resolvedParams} />;
}
