import { DateTime } from "luxon";
import { Trace } from "./model";

const TRACE_DURATION_MS = 1230;
// 5755ms into the replay demo session, which starts 7.5 minutes ago: the
// moment CheckoutActivity opens there.
const traceStart = DateTime.now().toUTC().minus({ milliseconds: 444245 });
const iso = (offsetMs: number) =>
  traceStart.plus({ milliseconds: offsetMs }).toISO()!;

export const demoTrace: Trace = {
  app_id: "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
  trace_id: "a3c7db90d18966d5c40a4a464b63ca69",
  session_id: "81f06f23-4291-4590-a5df-c96d57d3c692",
  user_id: "demo-user-id",
  start_time: iso(0),
  end_time: iso(TRACE_DURATION_MS),
  duration: TRACE_DURATION_MS,
  app_version: "2.0.0 (200)",
  os_version: "33",
  device_manufacturer: "Google",
  device_model: "Pixel 7 Pro",
  network_type: "Wifi",
  spans: [
    {
      span_name: "checkout_full_display",
      span_id: "root",
      parent_id: "",
      status: 0,
      start_time: iso(0),
      end_time: iso(TRACE_DURATION_MS),
      duration: TRACE_DURATION_MS,
      thread_name: "main",
      checkpoints: null,
    },
    {
      span_name: "api_fetch_rewards",
      span_id: "payments",
      parent_id: "root",
      status: 0,
      start_time: iso(43),
      end_time: iso(600),
      duration: 557,
      thread_name: "okhttp",
      user_defined_attributes: null,
      checkpoints: null,
    },
    {
      span_name: "api_fetch_inventory",
      span_id: "inventory",
      parent_id: "root",
      status: 2,
      start_time: iso(600),
      end_time: iso(785),
      duration: 185,
      thread_name: "okhttp",
      user_defined_attributes: {
        "http.method": "POST",
        "http.url": "/v1/inventory/check",
        "http.status_code": 503,
        "error.type": "service_unavailable",
      },
      checkpoints: null,
    },
    {
      span_name: "parse_response",
      span_id: "parse",
      parent_id: "root",
      status: 0,
      start_time: iso(785),
      end_time: iso(830),
      duration: 45,
      thread_name: "main",
      user_defined_attributes: null,
      checkpoints: null,
    },
    {
      span_name: "render_ui",
      span_id: "render",
      parent_id: "root",
      status: 0,
      start_time: iso(830),
      end_time: iso(TRACE_DURATION_MS),
      duration: 400,
      thread_name: "main",
      user_defined_attributes: null,
      checkpoints: null,
    },
    {
      span_name: "layout_pass",
      span_id: "layout",
      parent_id: "render",
      status: 0,
      start_time: iso(830),
      end_time: iso(990),
      duration: 160,
      thread_name: "main",
      user_defined_attributes: null,
      checkpoints: null,
    },
  ],
};
