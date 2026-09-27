"use client";

import JourneyMap from "@/app/components/journey_map/journey_map";
import { use } from "react";

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function JourneyMapPage({ params }: PageProps) {
  const resolvedParams = use(params);
  return <JourneyMap params={resolvedParams} />;
}
