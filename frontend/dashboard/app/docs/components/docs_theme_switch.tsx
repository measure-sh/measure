"use client";

import { ThemeToggle } from "@/app/components/theme_toggle";

// Rendered through fumadocs' themeSwitch slot so the docs use the same
// theme toggle as the dashboard and marketing pages. Fumadocs calls the
// slot with positioning classes (e.g. ms-auto in the sidebar footer), so
// they are kept on the wrapper div.
export default function DocsThemeSwitch({ className }: { className?: string }) {
  return (
    <div className={className}>
      <ThemeToggle />
    </div>
  );
}
