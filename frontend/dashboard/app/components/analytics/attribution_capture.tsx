"use client";

import { useEffect } from "react";
import { captureGCLIDFromURL } from "@/app/utils/analytics/attribution";

export default function AttributionCapture() {
  useEffect(() => {
    captureGCLIDFromURL();
  }, []);
  return null;
}
