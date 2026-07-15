import Link from "fumadocs-core/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/app/utils/shadcn_utils";

// Variant of the fumadocs Card. That component hardcodes bg-fd-muted on
// the icon chip, which in light mode puts brand-colored logos on a gray
// tile inside a white card. This card keeps the chip on the card surface
// color in light mode and muted in dark mode, where the lift reads well;
// everything else copies the fumadocs styling so it looks the same as
// cards rendered by the library.
//
// __tests__/docs/docs_card_test.tsx pins the parity with the fumadocs
// Card and fails if an upgrade changes their card, as a prompt to re-sync
// this copy.
type CardProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  href?: string;
  external?: boolean;
};

export function Card({
  icon,
  title,
  description,
  href,
  external,
  className,
  children,
  ...rest
}: CardProps) {
  const cardClassName = cn(
    "block rounded-xl border bg-fd-card p-4 text-fd-card-foreground transition-colors @max-lg:col-span-full",
    href && "hover:bg-fd-accent/80",
    className,
  );
  const content = (
    <>
      {icon ? (
        <div className="not-prose mb-2 w-fit rounded-lg border bg-fd-card p-1.5 text-fd-muted-foreground shadow-md dark:bg-fd-muted [&_svg]:size-4">
          {icon}
        </div>
      ) : null}
      <h3 className="not-prose mb-1 text-sm font-medium">{title}</h3>
      {description ? (
        <p className="my-0! text-sm text-fd-muted-foreground">{description}</p>
      ) : null}
      <div className="text-sm text-fd-muted-foreground prose-no-margin empty:hidden">
        {children}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        {...rest}
        href={href}
        external={external}
        data-card
        className={cardClassName}
      >
        {content}
      </Link>
    );
  }
  return (
    <div {...rest} data-card className={cardClassName}>
      {content}
    </div>
  );
}
