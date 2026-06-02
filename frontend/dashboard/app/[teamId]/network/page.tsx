import NetworkOverview from "@/app/components/network_overview";

export default async function NetworkPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const resolvedParams = await params;
  return <NetworkOverview params={resolvedParams} />;
}
