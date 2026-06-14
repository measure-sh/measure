import { describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import SimpleTooltip from "@/app/components/simple_tooltip";

describe("SimpleTooltip", () => {
  it("wraps children in a tooltip trigger when content is provided", () => {
    const { container } = render(
      <SimpleTooltip content="hello">
        <button>trigger</button>
      </SimpleTooltip>,
    );
    expect(
      container.querySelector('[data-slot="tooltip-trigger"]'),
    ).not.toBeNull();
    expect(screen.getByText("trigger")).toBeInTheDocument();
  });

  it("renders children with no tooltip when content is null", () => {
    const { container } = render(
      <SimpleTooltip content={null}>
        <button>trigger</button>
      </SimpleTooltip>,
    );
    expect(container.querySelector('[data-slot="tooltip-trigger"]')).toBeNull();
    expect(screen.getByText("trigger")).toBeInTheDocument();
  });

  it("renders children with no tooltip when content is an empty string", () => {
    const { container } = render(
      <SimpleTooltip content="">
        <button>trigger</button>
      </SimpleTooltip>,
    );
    expect(container.querySelector('[data-slot="tooltip-trigger"]')).toBeNull();
    expect(screen.getByText("trigger")).toBeInTheDocument();
  });

  it("merges triggerClassName onto the asChild trigger", () => {
    render(
      <SimpleTooltip content="hi" triggerClassName="transition-all">
        <button>trigger</button>
      </SimpleTooltip>,
    );
    // asChild (the default) merges trigger props onto the child element.
    expect(screen.getByText("trigger").className).toContain("transition-all");
  });
});
