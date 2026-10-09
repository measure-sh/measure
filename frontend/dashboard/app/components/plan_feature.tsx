import { LucideCheck } from "lucide-react";

export default function PlanFeature({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <LucideCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-700 dark:text-green-400" />
      <span>{children}</span>
    </li>
  );
}
