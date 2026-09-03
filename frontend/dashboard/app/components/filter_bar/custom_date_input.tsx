"use client";

import { DateTime } from "luxon";
import { useState } from "react";
import {
  formatIsoDateForDateTimeInputField,
  isValidTimestamp,
} from "../../utils/time_utils";
import { Input } from "../input";

export default function CustomDateTimeInput({
  timestamp,
  min,
  max,
  onChange,
}: {
  timestamp: string;
  min?: string;
  max?: string;
  onChange: (timestamp: string) => void;
}) {
  const [label, setLabel] = useState(
    formatIsoDateForDateTimeInputField(timestamp),
  );
  const [value, setValue] = useState(timestamp);
  if (timestamp !== value) {
    setValue(timestamp);
    setLabel(formatIsoDateForDateTimeInputField(timestamp));
  }

  return (
    <Input
      type="datetime-local"
      value={label}
      min={
        min === undefined ? undefined : formatIsoDateForDateTimeInputField(min)
      }
      max={
        max === undefined ? undefined : formatIsoDateForDateTimeInputField(max)
      }
      onChange={(e) => {
        const typed = e.target.value;
        if (!isValidTimestamp(typed)) {
          setLabel(typed);
          return;
        }
        const time = DateTime.fromISO(typed);
        const inRange =
          (min === undefined || time >= DateTime.fromISO(min)) &&
          (max === undefined || time <= DateTime.fromISO(max));
        setLabel(typed);
        if (inRange) {
          onChange(time.toISO()!);
        }
      }}
      // A value outside the range stays while the user edits the other
      // segments, and is put back on blur, so the input shows the range in
      // force and typing the same value again counts as a change.
      onBlur={() => setLabel(formatIsoDateForDateTimeInputField(value))}
    />
  );
}
