"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/shadcn_utils";
import { PortalContainerProvider } from "./portal_container";

// The demos are laid out for a desktop dashboard, so they render at this width
// inside the iframe and the iframe is scaled down to whatever width the frame
// gets. At the frame's widest, 1152px, that scale works out to 0.8, which is
// the ratio each caller's height class was picked against.
const CONTENT_WIDTH = 1440;

/**
 * The bordered window on the landing and product pages that shows a live
 * dashboard demo shrunk to fit.
 *
 * `children` render inside a same-origin iframe, and the iframe is scaled as
 * one unit. Scaling the dashboard directly with a CSS `transform: scale()`
 * breaks nivo charts, which size themselves from `getBoundingClientRect`: that
 * returns the already-transformed size, so a chart shrinks a second time when
 * the transform paints. An iframe is a separate document, so code inside it
 * measures against the iframe's own viewport and never sees the outer
 * transform. `children` are portaled into the iframe body, which React context
 * still flows through, and the host page's stylesheets and theme class are
 * copied in so the demo matches the surrounding page.
 *
 * Below the `md` breakpoint the frame is hidden and callers show a screenshot
 * instead. Hiding it in CSS alone would still create the iframe and mount the
 * whole dashboard inside it, so the demo renders only once a media query
 * reports a wide viewport. That query is unmatched on the first client render,
 * so the frame starts empty and fills in immediately after, and the iframe
 * stays hidden until it has measured itself, so neither step shows as a flash.
 */
export default function ScaledPreview({
  heightClassName,
  children,
}: {
  heightClassName: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isWideViewport, setIsWideViewport] = useState(false);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [{ scale, height }, setLayout] = useState({ scale: 0, height: 0 });

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setIsWideViewport(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Scale the iframe so its fixed content width fits the container width, and
  // size it so the scaled height fills the container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isWideViewport) {
      return;
    }
    const measure = () => {
      const nextScale = el.clientWidth / CONTENT_WIDTH;
      setLayout({
        scale: nextScale,
        height: nextScale > 0 ? el.clientHeight / nextScale : 0,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isWideViewport]);

  // Copy the host document's stylesheets and theme class into the iframe and
  // expose its body as the portal target.
  useEffect(() => {
    if (!isWideViewport) {
      return;
    }
    const syncTheme = () => {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        doc.documentElement.className = document.documentElement.className;
      }
    };
    const syncDocument = () => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) {
        return;
      }
      doc.head.replaceChildren(
        ...Array.from(
          document.querySelectorAll('style, link[rel="stylesheet"]'),
        ).map((node) => node.cloneNode(true)),
      );
      doc.body.className = document.body.className;
      doc.body.style.margin = "0";
      syncTheme();
      setBody(doc.body);
    };

    syncDocument();
    const iframe = iframeRef.current;
    iframe?.addEventListener("load", syncDocument);

    // Keep styles (dev HMR / dynamic injection) and theme (dark mode) in sync.
    const headObserver = new MutationObserver(syncDocument);
    headObserver.observe(document.head, { childList: true });
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      iframe?.removeEventListener("load", syncDocument);
      headObserver.disconnect();
      themeObserver.disconnect();
    };
  }, [isWideViewport]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative hidden md:block w-full border border-border rounded-lg shadow-xl overflow-hidden",
        heightClassName,
      )}
    >
      {isWideViewport ? (
        <iframe
          ref={iframeRef}
          title="Dashboard preview"
          style={{
            border: 0,
            width: CONTENT_WIDTH,
            height: height || "100%",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            visibility: body && scale > 0 ? "visible" : "hidden",
          }}
        />
      ) : null}
      {body
        ? createPortal(
            <PortalContainerProvider value={body}>
              <div className="bg-background text-foreground min-h-screen px-8 py-12">
                {children}
              </div>
            </PortalContainerProvider>,
            body,
          )
        : null}
    </div>
  );
}
