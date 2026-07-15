/**
 * Pins the fumadocs CodeBlock internals that TrackedCodeBlock depends on,
 * so a fumadocs upgrade that changes them fails here instead of silently
 * skewing analytics:
 *
 * - extra props (the tracking onClick) are spread onto the block's root
 *   element, where they can observe clicks anywhere inside the block
 * - the copy control is the only button rendered inside a code block, so
 *   any click landing within a button is a copy
 */
import { beforeAll, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render } from "@testing-library/react";

jest.mock("@/app/utils/analytics/track", () => ({
  track: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  __esModule: true,
  usePathname: () => "/docs/crash-reporting",
}));

import { track } from "@/app/utils/analytics/track";
import { TrackedCodeBlock } from "@/app/docs/components/tracked_code_block";

const writeText = jest.fn().mockResolvedValue(undefined);

beforeAll(() => {
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

function renderBlock(props?: { title?: string }) {
  return render(
    <TrackedCodeBlock {...props}>
      <code>val client = MeasureClient()</code>
    </TrackedCodeBlock>,
  );
}

describe("TrackedCodeBlock", () => {
  it("renders exactly one button, the copy control", () => {
    const plain = renderBlock();
    expect(plain.container.querySelectorAll("button")).toHaveLength(1);

    const titled = renderBlock({ title: "build.gradle" });
    expect(titled.container.querySelectorAll("button")).toHaveLength(1);
  });

  it("tracks a copy when the copy button is clicked via its inner icon", async () => {
    const { container } = renderBlock();
    const icon = container.querySelector("button svg");
    expect(icon).not.toBeNull();

    // The awaited act flushes the copy handler's promise chain, which
    // flips the button's checked state one microtask after the click.
    await act(async () => {
      fireEvent.click(icon!);
    });

    // The clipboard write proves the one button really is the copy control.
    expect(writeText).toHaveBeenCalledWith("val client = MeasureClient()");
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("docs_action_click", {
      action: "copy_code",
      doc_section: "crash-reporting",
    });
  });

  it("does not track clicks elsewhere in the block", () => {
    const { container } = renderBlock({ title: "build.gradle" });

    fireEvent.click(container.querySelector("pre")!);
    fireEvent.click(container.querySelector("figcaption")!);

    expect(track).not.toHaveBeenCalled();
  });
});
