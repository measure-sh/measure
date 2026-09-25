import { Badge } from "@/app/components/badge";

export default function BetaBadge() {
  return (
    <sup>
      <Badge variant="outline" className="select-none">
        Beta
      </Badge>
    </sup>
  );
}
