import { RefObject, useCallback } from "react";

// Pointer-driven drag handler for a vertical column resizer. Reports the
// cursor's horizontal fraction within `containerRef` (clamped to [min, max])
// for each move and releases pointer capture on up.
export function useColumnResizer(args: {
  containerRef: RefObject<HTMLDivElement | null>;
  min: number;
  max: number;
  setFraction: (f: number) => void;
}): (e: React.PointerEvent<HTMLDivElement>) => void {
  const { containerRef, min, max, setFraction } = args;
  return useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      e.preventDefault();
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        const fraction = (ev.clientX - rect.left) / rect.width;
        setFraction(Math.min(max, Math.max(min, fraction)));
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        try {
          (e.target as HTMLDivElement).releasePointerCapture(ev.pointerId);
        } catch {
          // ignore — already released or unsupported
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [containerRef, min, max, setFraction],
  );
}
