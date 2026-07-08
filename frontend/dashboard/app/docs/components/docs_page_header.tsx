import { cn } from "@/app/utils/shadcn_utils";
import { accentGreenTextStyle } from "@/app/utils/shared_styles";

interface DocsPageHeaderProps {
  /** Sidebar cluster label; null for pages outside any labeled cluster. */
  eyebrow: string | null;
  heading: string;
  description: string;
}

// Header block above the markdown body: section eyebrow, page title and
// description lead. The eyebrow is dropped when it would repeat the title
// (e.g. the hosting overview, whose title is the cluster label).
export default function DocsPageHeader({
  eyebrow,
  heading,
  description,
}: DocsPageHeaderProps) {
  const showEyebrow =
    eyebrow !== null &&
    eyebrow !== "" &&
    eyebrow.toLowerCase() !== heading.toLowerCase();

  return (
    <header className="space-y-2.5">
      {showEyebrow && (
        <p
          className={cn("font-body text-xs font-medium", accentGreenTextStyle)}
        >
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-3xl font-semibold leading-9 tracking-[-0.03125rem] text-foreground">
        {heading}
      </h1>
      {description !== "" && (
        <p className="font-body leading-7 text-muted-foreground">
          {description}
        </p>
      )}
    </header>
  );
}
