"use client";

import UserJourneys from "@/app/components/user_journeys";
import { use } from "react";

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function UserJourneysPage({ params }: PageProps) {
  const resolvedParams = use(params);
  return <UserJourneys params={resolvedParams} />;
}
