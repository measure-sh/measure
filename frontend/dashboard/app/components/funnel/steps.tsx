"use client";

import { ChevronRight } from "lucide-react";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import type { Funnel } from "../../api/api_calls";
import { formatFunnelSteps } from "./format";
import { useStepColor } from "./step_color";
import { cn } from "../../utils/shadcn_utils";
import Pill from "../pill";

function Step({
  color,
  className,
  children,
  ...props
}: {
  color?: string;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("flex items-center gap-1.5 min-w-0", className)}
      {...props}
    >
      {color !== undefined && (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="truncate">{children}</span>
    </span>
  );
}

function hiddenStepsLabel(count: number): string {
  return `+${count} ${count === 1 ? "step" : "steps"}`;
}

function withChevrons(items: React.ReactElement[]) {
  return items.map((item, index) => (
    <Fragment key={item.key}>
      {index > 0 && <ChevronRight className="shrink-0 text-muted-foreground" />}
      {item}
    </Fragment>
  ));
}

// When the whole event names leave room in the pill, one more name is shown
// truncated with an ellipsis, like "category…". That happens only when the room
// is at least this wide.
const MIN_TRUNCATED_STEP_WIDTH = 64;

type CollapsedSteps = {
  // How many steps from the start of the funnel are shown before the
  // "+N steps" label.
  leading: number;
  // Whether the last of those steps is truncated with an ellipsis.
  truncated: boolean;
};

// Returns null when every step fits. When even the first step does not fit
// beside the "+N steps" label and the last step, every event name is truncated.
function collapseSteps(
  available: number,
  measurer: HTMLElement,
): CollapsedSteps | null {
  const pill = measurer.firstElementChild!;
  const full = pill.getBoundingClientRect().width;
  const steps = [...pill.querySelectorAll("[data-funnel-step]")].map((step) =>
    step.getBoundingClientRect(),
  );
  const label = pill.querySelector("[data-hidden-steps]");
  if (full <= available || steps.length < 3 || label === null) {
    return null;
  }

  const separator = steps[1].left - steps[0].right;
  let width = full + label.getBoundingClientRect().width + separator;
  for (let leading = steps.length - 2; leading >= 1; leading--) {
    width -= steps[leading].width + separator;
    if (width <= available) {
      const truncated =
        leading < steps.length - 2 &&
        available - width - separator >= MIN_TRUNCATED_STEP_WIDTH;
      return { leading: truncated ? leading + 1 : leading, truncated };
    }
  }
  return { leading: 1, truncated: false };
}

// The funnel's events in step order, in one pill. When the pill is too wide,
// it shows as many of the first events as fit, a count of the hidden steps,
// and the last event.
export default function FunnelSteps({ funnel }: { funnel: Funnel }) {
  const colorOf = useStepColor();
  const { steps } = funnel;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const measurerRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<CollapsedSteps | null>(null);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current!;
    const measurer = measurerRef.current!;
    const update = () =>
      setCollapsed(
        collapseSteps(wrapper.getBoundingClientRect().width, measurer),
      );
    update();
    // Fonts that finish loading after the first measurement change the width
    // of every event name.
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    observer.observe(measurer.firstElementChild!);
    return () => observer.disconnect();
  }, [funnel]);

  // When a step is truncated, every other step gets `shrink-0`, so the browser
  // shortens only the truncated step's name to fit the pill.
  const step = (index: number, shrink = true) => (
    <Step
      key={index}
      color={colorOf(index)}
      className={shrink ? undefined : "shrink-0"}
    >
      {steps[index].event_name}
    </Step>
  );
  let items: React.ReactElement[];
  if (collapsed === null) {
    items = steps.map((_, index) => step(index));
  } else {
    const { leading, truncated } = collapsed;
    items = [
      ...steps
        .slice(0, leading)
        .map((_, index) => step(index, !truncated || index === leading - 1)),
      <Step key="hidden" className="shrink-0 text-muted-foreground">
        {hiddenStepsLabel(steps.length - 1 - leading)}
      </Step>,
      step(steps.length - 1, !truncated),
    ];
  }

  return (
    <div ref={wrapperRef} className="min-w-0 max-w-full">
      {/* A hidden copy of the pill that shows every event at full width. Its
          width makes the layout give this component the room every event
          needs, or all the room there is, and the events in it are measured
          to decide how many fit. */}
      <div
        ref={measurerRef}
        aria-hidden="true"
        className="invisible h-0 overflow-hidden"
      >
        <Pill className="w-max gap-1.5">
          {withChevrons(
            steps.map((s, index) => (
              <Step key={index} color={colorOf(index)} data-funnel-step="">
                {s.event_name}
              </Step>
            )),
          )}
          {steps.length > 2 && (
            <Step className="absolute" data-hidden-steps="">
              {hiddenStepsLabel(steps.length - 2)}
            </Step>
          )}
        </Pill>
      </div>
      <Pill
        tooltip={formatFunnelSteps(funnel)}
        className="shrink min-w-0 max-w-full justify-start gap-1.5"
      >
        {withChevrons(items)}
      </Pill>
    </div>
  );
}
