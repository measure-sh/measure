"use client";

import { useEffect } from "react";
import { captureUTMsFromURL } from "@/app/utils/analytics/utm";

export default function UTMCapture() {
  useEffect(() => {
    captureUTMsFromURL();
  }, []);
  return null;
}
