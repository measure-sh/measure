/**
 * Pins the styling parity between the docs Card and the fumadocs Card it
 * copies (app/docs/components/card.tsx): the two must render identical
 * DOM except for the icon chip's background classes. A fumadocs upgrade
 * that changes their card fails here, as a prompt to re-sync ours.
 */
import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import { Card as FumadocsCard } from "fumadocs-ui/components/card";
import type { ComponentProps, ReactNode } from "react";

import { Card } from "@/app/docs/components/card";

/** An element tree reduced to what the parity check compares. */
interface ElementShape {
  tag: string;
  attrs: Record<string, string>;
  classes: string[];
  children: ElementShape[];
}

function shapeOf(el: Element): ElementShape {
  const attrs: Record<string, string> = {};
  for (const attr of el.attributes) {
    if (attr.name !== "class") {
      attrs[attr.name] = attr.value;
    }
  }
  return {
    tag: el.tagName.toLowerCase(),
    attrs,
    classes: [...el.classList].sort(),
    children: [...el.children].map(shapeOf),
  };
}

/**
 * The one intended divergence: our chip sits on the card surface color in
 * light mode instead of the muted gray. Applying this to the fumadocs
 * shape must yield our shape exactly.
 */
function applyChipDelta(shape: ElementShape): ElementShape {
  const isChip = shape.classes.includes("bg-fd-muted");
  return {
    ...shape,
    classes: isChip
      ? shape.classes
          .filter((c) => c !== "bg-fd-muted")
          .concat(["bg-fd-card", "dark:bg-fd-muted"])
          .sort()
      : shape.classes,
    children: shape.children.map(applyChipDelta),
  };
}

function shapesFor(props: ComponentProps<typeof Card> & { title: ReactNode }) {
  const ours = render(<Card {...props} />);
  const theirs = render(<FumadocsCard {...props} />);
  return {
    ours: shapeOf(ours.container.firstElementChild!),
    theirs: shapeOf(theirs.container.firstElementChild!),
    oursText: ours.container.textContent,
    theirsText: theirs.container.textContent,
  };
}

describe("docs Card parity with fumadocs Card", () => {
  it("renders identical DOM for a plain card", () => {
    const { ours, theirs, oursText, theirsText } = shapesFor({
      title: "Android",
      description: "Integrate the SDK in Kotlin and Java apps.",
      children: <p>More details.</p>,
    });

    expect(ours).toEqual(theirs);
    expect(oursText).toEqual(theirsText);
  });

  it("renders identical DOM for a linked card up to the chip delta", () => {
    // An external href keeps fumadocs' Link on its plain anchor branch,
    // which needs no framework provider in the test environment.
    const { ours, theirs, oursText, theirsText } = shapesFor({
      title: "Android",
      description: "Integrate the SDK in Kotlin and Java apps.",
      href: "https://example.com/docs",
      icon: <span data-testid="icon">i</span>,
    });

    expect(ours).toEqual(applyChipDelta(theirs));
    expect(oursText).toEqual(theirsText);
  });

  it("diverges from fumadocs only on the chip background", () => {
    const { ours, theirs } = shapesFor({
      title: "Android",
      icon: <span>i</span>,
    });

    // Guards the delta itself: if this fails, the chip styling in
    // app/docs/components/card.tsx or applyChipDelta is out of date.
    expect(ours).not.toEqual(theirs);
    expect(ours).toEqual(applyChipDelta(theirs));
  });
});
