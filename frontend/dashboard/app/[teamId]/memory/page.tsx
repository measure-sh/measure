import MemoryMonitoring from "@/app/components/memory_monitoring";

export default async function MemoryPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const resolvedParams = await params;
  return <MemoryMonitoring params={resolvedParams} />;
}
