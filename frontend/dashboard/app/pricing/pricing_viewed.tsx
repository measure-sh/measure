"use client";

import { track } from "@/app/utils/analytics/track";
import { useEffect, useRef } from "react";

export default function PricingViewed() {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) {
      return;
    }
    fired.current = true;
    track("pricing_viewed");
  }, []);
  return null;
}
