import { createEvent, fireEvent } from "@testing-library/react";

// jsdom has no PointerEvent, so testing-library creates a plain Event and
// drops pointerType, button, and clientX from its initializer. This helper sets
// all three on the event before firing it.
function firePointer(
  type: "pointerDown" | "pointerLeave",
  target: Element,
  pointerType: string,
  init: { clientX?: number },
) {
  const event = createEvent[type](target);
  const fields = { pointerType, button: 0, ...init };
  for (const [name, value] of Object.entries(fields)) {
    Object.defineProperty(event, name, { value });
  }
  fireEvent(target, event);
}

export function pointerDown(
  target: Element,
  pointerType: string,
  init: { clientX?: number } = {},
) {
  firePointer("pointerDown", target, pointerType, init);
}

export function pointerLeave(target: Element, pointerType: string) {
  firePointer("pointerLeave", target, pointerType, {});
}
