"use client";

import { useId, useState } from "react";
import { Slider } from "./slider";
import { cn } from "../utils/shadcn_utils";

type SyncedInputSliderProps = {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  // A number, or a function of the current value (for value-dependent steps).
  step: number | ((value: number) => number);
  integer?: boolean;
  // Decimal places kept for non-integer fields.
  precision?: number;
  // Unit shown after the value, e.g. "%" or "users".
  suffix?: string;
  rangeStartLabel: string;
  rangeEndLabel: string;
  large?: boolean;
  className?: string;
};

export function SyncedInputSlider({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
  integer = false,
  precision = 4,
  suffix,
  rangeStartLabel,
  rangeEndLabel,
  large = false,
  className,
}: SyncedInputSliderProps) {
  const inputId = useId();

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const round = (n: number) => {
    if (integer) {
      return Math.round(n);
    }
    const factor = Math.pow(10, precision);
    return Math.round(n * factor) / factor;
  };

  // Clamp to [min, max] and snap to the field's numeric type. Both the slider
  // and the input route every value through here, so they can't disagree.
  const normalize = (n: number) => clamp(round(n));

  const parse = (str: string) =>
    integer ? parseInt(str, 10) : parseFloat(str.replace(/,/g, ""));

  // Grouped form shown when the field isn't being edited, e.g. "1,000".
  const formatIdle = (n: number) =>
    integer
      ? n.toLocaleString("en-US")
      : n.toLocaleString("en-US", { maximumFractionDigits: precision });

  // Separator-free form that's easy to edit.
  const formatEditing = (n: number) => n.toString();

  const [text, setText] = useState(() => formatIdle(value));
  const [focused, setFocused] = useState(false);

  // Sync outside changes (e.g. dragging the slider) into the input, unless the
  // user is mid-edit.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!focused) {
      setText(formatIdle(value));
    }
  }

  const handleChange = (raw: string) => {
    setText(raw);
    const parsed = parse(raw);
    if (raw.trim() !== "" && !Number.isNaN(parsed)) {
      onChange(normalize(parsed));
    }
  };

  const handleFocus = () => {
    setFocused(true);
    setText(formatEditing(value));
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parse(text);
    if (text.trim() === "" || Number.isNaN(parsed)) {
      // Nothing usable entered, so keep the last good value.
      setText(formatIdle(value));
      return;
    }
    const next = normalize(parsed);
    onChange(next);
    setText(formatIdle(next));
  };

  const sliderStep = typeof step === "function" ? step(value) : step;
  const textSize = large ? "text-2xl" : "text-xl";
  // Size to the current text (plus slack for the caret) so the box grows with
  // the value rather than reserving room for the largest possible one.
  const inputWidth = Math.max(text.length + 1, 3);

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-4 gap-2">
        <div>
          <label htmlFor={inputId} className={cn(textSize, "font-display")}>
            {label}
          </label>
          <p className="text-sm py-2 text-muted-foreground font-body">
            {description}
          </p>
        </div>
        <div
          className={cn("flex items-baseline gap-1.5 font-display", textSize)}
        >
          <input
            id={inputId}
            type="text"
            inputMode={integer ? "numeric" : "decimal"}
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            // `ch` ≈ one digit, so the box width tracks the digit count. content-box
            // makes that width the digits' space; the default border-box would split
            // it between digits and padding, clipping the number.
            style={{ width: `${inputWidth}ch` }}
            className={cn(
              "box-content rounded-md border border-input bg-transparent px-2.5 py-1 text-right outline-none",
              "transition-[color,box-shadow,width]",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            )}
          />
          {suffix && <span>{suffix}</span>}
        </div>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(normalize(v[0]))}
        min={min}
        max={max}
        step={sliderStep}
        aria-label={label}
        className="mb-2"
      />
      <div className="flex justify-between text-sm text-muted-foreground font-body">
        <span>{rangeStartLabel}</span>
        <span>{rangeEndLabel}</span>
      </div>
    </div>
  );
}
