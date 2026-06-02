"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PortalContainerProvider } from "./portal_container";

/**
 * Renders `children` inside a same-origin iframe and scales the iframe down to
 * fit this component's width.
 *
 * The product pages show the full dashboard shrunk into a preview window. Doing
 * that with a CSS `transform: scale()` directly on the dashboard breaks nivo
 * charts: they size themselves from `getBoundingClientRect`, which returns the
 * already-transformed size, so the chart shrinks a second time when the
 * transform paints. An iframe is a separate document — code inside measures
 * against the iframe's own viewport and never sees the outer transform — so the
 * dashboard renders at its true size internally and the whole iframe is scaled
 * as one unit. This is the standard way to render a scaled live UI preview.
 *
 * `children` are portaled into the iframe body (React context still flows
 * through the portal), and the host page's stylesheets + theme class are
 * mirrored into the iframe so it looks identical.
 */
export default function ScaledPreview({
  children,
  contentWidth = 1440,
}: {
  children: React.ReactNode;
  contentWidth?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [{ scale, height }, setLayout] = useState({ scale: 0, height: 0 });

  // Scale the iframe so its fixed content width fits the container width, and
  // size it so the scaled height fills the container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      const nextScale = el.clientWidth / contentWidth;
      setLayout({
        scale: nextScale,
        height: nextScale > 0 ? el.clientHeight / nextScale : 0,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [contentWidth]);

  // Mirror the host document into the iframe (stylesheets, fonts, theme class)
  // and expose its body as the portal target.
  useEffect(() => {
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
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      <iframe
        ref={iframeRef}
        title="Dashboard preview"
        style={{
          border: 0,
          width: contentWidth,
          height: height || "100%",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          visibility: body && scale > 0 ? "visible" : "hidden",
        }}
      />
      {body
        ? createPortal(
            <PortalContainerProvider value={body}>
              {children}
            </PortalContainerProvider>,
            body,
          )
        : null}
    </div>
  );
}
