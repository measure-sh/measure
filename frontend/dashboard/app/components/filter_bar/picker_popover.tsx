import type { ReactNode, RefObject } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

// Radix runs this when a picker has finished closing, and by default then
// focuses the picker's trigger. By then the bar has often opened another
// picker on the same condition, which already holds focus, and focusing the
// trigger would take it away. So when focus is already outside the closed
// picker, it stays there. Otherwise, as after Escape, focus goes to the control
// the caller named, or to the trigger when the caller named none.
function settleFocusOnClose(
  e: Event,
  focusOnClose?: RefObject<HTMLElement | null>,
) {
  const active = document.activeElement;
  const content = e.currentTarget as HTMLElement | null;
  const elsewhere =
    active !== null && active !== document.body && !content?.contains(active);
  if (elsewhere) {
    e.preventDefault();
    return;
  }
  if (focusOnClose?.current) {
    e.preventDefault();
    focusOnClose.current.focus();
  }
}

// A picker is dismissed by any pointer press outside it. A picker that belongs
// to a condition chip is given the chip's element as `stayOpenWithin`, and a
// plain left press anywhere inside that chip does not close the picker, so
// pressing another segment of the chip opens that segment's picker. Right,
// middle and ctrl presses still dismiss.
function keepOpenWithin(
  stayOpenWithin: RefObject<HTMLElement | null> | undefined,
) {
  return (e: {
    detail: { originalEvent: PointerEvent };
    preventDefault: () => void;
  }) => {
    const { target, button, ctrlKey } = e.detail.originalEvent;
    if (
      button === 0 &&
      !ctrlKey &&
      stayOpenWithin?.current?.contains(target as Node)
    ) {
      e.preventDefault();
    }
  };
}

export function PickerPopover({
  open,
  onOpenChange,
  trigger,
  className,
  align = "start",
  focusOnClose,
  stayOpenWithin,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  className: string;
  align?: "start" | "end";
  focusOnClose?: RefObject<HTMLElement | null>;
  stayOpenWithin?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    // modal keeps the TAB key inside the open list, and returns focus to
    // whatever opened it when the list closes.
    <Popover open={open} onOpenChange={onOpenChange} modal>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className={className}
        align={align}
        onCloseAutoFocus={(e) => settleFocusOnClose(e, focusOnClose)}
        onPointerDownOutside={keepOpenWithin(stayOpenWithin)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
