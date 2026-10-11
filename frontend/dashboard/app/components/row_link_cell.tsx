import Link from "next/link";
import React from "react";
import SimpleTooltip from "./simple_tooltip";
import { TableCell } from "./table";

const RowLinkCell: React.FC<{
  href: string;
  className: string;
  // Shown when the user hovers the cell, such as the full text of content
  // that is cut off.
  tooltip?: string;
  children: React.ReactNode;
}> = ({ href, className, tooltip, children }) => (
  <TableCell className={`${className} select-none relative p-0`}>
    {/* The link covers the cell, so the tooltip is attached to the link. */}
    <SimpleTooltip content={tooltip}>
      <Link
        href={href}
        className="absolute inset-0 z-10 cursor-pointer"
        tabIndex={-1}
        aria-hidden="true"
        style={{ display: "block" }}
      />
    </SimpleTooltip>
    <div className="pointer-events-none p-4">{children}</div>
  </TableCell>
);

export default RowLinkCell;
