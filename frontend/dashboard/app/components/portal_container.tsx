"use client";

import { createContext, useContext } from "react";

/**
 * The DOM node that floating Radix layers (tooltips, popovers, …) portal into.
 * `null` keeps Radix's default — the host document body. ScaledPreview sets it
 * to the iframe body so floating UI renders inside the iframe alongside its
 * trigger, instead of escaping to the host page (which breaks positioning and
 * hover tracking across the iframe boundary).
 */
const PortalContainerContext = createContext<HTMLElement | null>(null);

export const PortalContainerProvider = PortalContainerContext.Provider;

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext);
}
