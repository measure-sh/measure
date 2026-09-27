import type { JourneyMapScreen, JourneyMapVariant } from "@/app/api/api_calls";

export function screenTitle(screen: JourneyMapScreen): string {
  return screen.screen || screen.host || screen.key;
}

// The backend reports how a visit arrived as the tap that caused it, or this
// marker for the first screen of a session.
const sessionStart = "session start";

function inboundLabel(label: string): string {
  return label === sessionStart ? "At session start" : `Via ${label}`;
}

// What best tells a variant apart: how visits arrived in it, otherwise the
// tap made while in it.
export function variantHint(variant: JourneyMapVariant): string {
  if (variant.loading) {
    return "Still loading";
  }
  if (variant.inbound.length > 0) {
    return inboundLabel(variant.inbound[0].label);
  }
  if (variant.taps.length > 0) {
    return `Tapping ${variant.taps[0].label}`;
  }
  return "";
}
