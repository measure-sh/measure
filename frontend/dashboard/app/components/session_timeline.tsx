"use client";

import { ResponsiveLineCanvas } from "@nivo/line";
import { DateTime } from "luxon";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { emptySessionTimeline } from "../api/api_calls";
import { kilobytesToMegabytes } from "../utils/number_utils";
import { useChartColor, useChartColors } from "../utils/shared_styles";
import {
  formatChartFormatTimestampToHumanReadable,
  formatMillisToHumanReadable,
  formatTimestampToChartFormat,
} from "../utils/time_utils";
import DropdownSelect, { DropdownSelectType } from "./dropdown_select";

import { useTheme } from "next-themes";
import Pill from "./pill";
import { PlotTooltipShell, PlotTooltipSwatch } from "./plot_tooltip";
import SessionTimelineEventCell from "./session_timeline_event_cell";

const demoTimelineLastEventTime = DateTime.now().toUTC();
const demoTimeline: typeof emptySessionTimeline = {
  app_id: "19e26d60-2ad8-4ef7-8aab-333e1f5377fc",
  attribute: {
    installation_id: "1fefa265-9e6b-45d8-aa83-23b03070c06e",
    app_version: "2.0.0",
    app_build: "200",
    app_unique_id: "sh.measure.sample",
    measure_sdk_version: "1.0.0",
    platform: "android",
    thread_name: "msr-default",
    user_id: "dummy-user-id",
    device_name: "sunfish",
    device_model: "Pixel 7 Pro",
    device_manufacturer: "Google",
    device_type: "phone",
    device_is_foldable: false,
    device_is_physical: true,
    device_density_dpi: 440,
    device_width_px: 1080,
    device_height_px: 2138,
    device_density: 2.75,
    device_locale: "en-US",
    device_low_power_mode: false,
    device_thermal_throttling_enabled: false,
    device_cpu_arch: "",
    os_name: "android",
    os_version: "33",
    os_page_size: 0,
    network_type: "Wifi",
    network_provider: "unknown",
    network_generation: "unknown",
  },
  cpu_usage: [
    {
      timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).toISO(),
      value: 5,
    },
    {
      timestamp: demoTimelineLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 3 })
        .toISO(),
      value: 15.625,
    },
    {
      timestamp: demoTimelineLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 6 })
        .toISO(),
      value: 12.314,
    },
    {
      timestamp: demoTimelineLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 9 })
        .toISO(),
      value: 35.742,
    },
    {
      timestamp: demoTimelineLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 12 })
        .toISO(),
      value: 38.923,
    },
  ],
  duration: 150000,
  memory_usage: [
    {
      java_max_heap: 262144,
      java_total_heap: 262144,
      java_free_heap: 259685,
      total_pss: 10846,
      rss: 105040,
      native_total_heap: 12612,
      native_free_heap: 1170,
      interval: 0,
      timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).toISO(),
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 58687,
      total_pss: 57496,
      rss: 135104,
      native_total_heap: 17752,
      native_free_heap: 1259,
      interval: 2056,
      timestamp: demoTimelineLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 3 })
        .toISO(),
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 58391,
      total_pss: 57572,
      rss: 135240,
      native_total_heap: 17752,
      native_free_heap: 1229,
      interval: 2043,
      timestamp: demoTimelineLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 6 })
        .toISO(),
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 57931,
      total_pss: 59015,
      rss: 136396,
      native_total_heap: 18520,
      native_free_heap: 1314,
      interval: 2055,
      timestamp: demoTimelineLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 9 })
        .toISO(),
    },
    {
      java_max_heap: 262144,
      java_total_heap: 65536,
      java_free_heap: 57162,
      total_pss: 59904,
      rss: 137996,
      native_total_heap: 19544,
      native_free_heap: 1307,
      interval: 2032,
      timestamp: demoTimelineLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 12 })
        .toISO(),
    },
  ],
  memory_usage_absolute: null,
  session_id: "81f06f23-4291-4590-a5df-c96d57d3c692",
  threads: {
    main: [
      {
        event_type: "hot_launch",
        user_defined_attribute: null,
        thread_name: "main",
        duration: 28,
        timestamp: demoTimelineLastEventTime.minus({ minutes: 7.5 }).toISO(),
      },
      {
        event_type: "lifecycle_app",
        user_defined_attribute: null,
        thread_name: "main",
        type: "foreground",
        timestamp: demoTimelineLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 43 })
          .toISO(),
      },
      {
        event_type: "lifecycle_activity",
        user_defined_attribute: null,
        thread_name: "main",
        type: "resumed",
        class_name: "sh.measure.demo.CheckoutActivity",
        timestamp: demoTimelineLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 91 })
          .toISO(),
      },
      {
        event_type: "custom",
        user_defined_attribute: {
          payment_methods:
            '{"payment_methods":[{"name": "personal", "type":"credit_card", "currency": "GBP", "balance": 1000}]}',
        },
        thread_name: "main",
        user_triggered: true,
        name: "Payment Methods Fetched",
        timestamp: demoTimelineLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ seconds: 1 })
          .toISO(),
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_discount_1",
        label: "Apply discount",
        semantic_label: "Apply discount code",
        width: 125,
        height: 200,
        x: 102,
        y: 403,
        timestamp: demoTimelineLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ seconds: 6 })
          .toISO(),
        attachments: [
          {
            id: "125df6e5-1e45-4380-bcc6-8c13e50439f8",
            name: "snapshot.svg",
            type: "layout_snapshot_json",
            key: "demo_snapshot_discount_click",
            location: "/snapshots/demo_snapshot_discount_click.json",
          },
        ],
      },
      {
        event_type: "gesture_click",
        user_defined_attribute: null,
        thread_name: "main",
        target: "com.google.android.material.button.MaterialButton",
        target_id: "btn_pay",
        label: "Pay now",
        semantic_label: "Pay now",
        width: 1080,
        height: 200,
        x: 125,
        y: 1674,
        timestamp: demoTimelineLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ seconds: 13 })
          .toISO(),
        attachments: [
          {
            id: "125df6e5-1e45-4380-bcc6-8c13e50439f8",
            name: "snapshot.svg",
            type: "layout_snapshot_json",
            key: "demo_snapshot_pay_click",
            location: "/snapshots/demo_snapshot_pay_click.json",
          },
        ],
      },
      {
        event_type: "error",
        severity: "fatal",
        user_defined_attribute: null,
        user_triggered: false,
        group_id: "9b71282275e88a68b38fe69a1bda0ea7",
        type: "java.lang.IllegalStateException",
        message: "Payment method must be specified",
        method_name: "onClick",
        file_name: "CheckoutActivity.kt",
        line_number: 102,
        thread_name: "main",
        handled: false,
        timestamp: demoTimelineLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ seconds: 13 })
          .toISO(),
        stacktrace:
          "java.lang.IllegalStateException: Payment method must be specified\n\tat MaterialButton.onClick(CheckoutActivity.kt:102)\n\tat android.view.View.performClick(View.java:6294)\n\tat android.view.View$PerformClick.run(View.java:24774)\n\tat android.os.Handler.handleCallback(Handler.java:790)\n\tat android.os.Handler.dispatchMessage(Handler.java:99)\n\tat android.os.Looper.loop(Looper.java:164)\n\tat android.app.ActivityThread.main(ActivityThread.java:6518)\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:438)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)\nCaused by: java.lang.IllegalStateException: This is a new exception\n\tat java.lang.reflect.Method.invoke(Method.java:-2)\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:438)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)\nCaused by: java.lang.reflect.InvocationTargetException\n\tat com.android.internal.os.RuntimeInit$MethodAndArgsCaller.run(RuntimeInit.java:448)\n\tat com.android.internal.os.ZygoteInit.main(ZygoteInit.java:807)",
      },
    ],
    okhttp: [
      {
        event_type: "http",
        user_defined_attribute: null,
        thread_name: "okhttp",
        user_triggered: false,
        url: "https://payments.demo-provider.com/demo-user-id/payment-methods",
        method: "GET",
        status_code: 200,
        request_body: "",
        response_body:
          '{"payment_methods":[{"name": "personal", "type":"credit_card", "currency": "GBP", "balance": 1000}]}',
        failure_reason: "",
        failure_description: "",
        client: "okhttp",
        duration: 742,
        timestamp: demoTimelineLastEventTime
          .minus({ minutes: 7.5 })
          .plus({ milliseconds: 143 })
          .toISO(),
      },
    ],
  },
  traces: [
    {
      trace_id: "14f94d4e346a4bb36cf7eb06dae727ff",
      trace_name: "CheckoutActivity Time to Full Display",
      thread_name: "main",
      start_time: demoTimelineLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ milliseconds: 43 })
        .toISO(),
      end_time: demoTimelineLastEventTime
        .minus({ minutes: 7.5 })
        .plus({ seconds: 1, milliseconds: 230 })
        .toISO(),
      duration: 1187,
    },
  ],
} as any;

interface SessionTimelineProps {
  teamId?: string;
  appId?: string;
  sessionTimeline?: typeof emptySessionTimeline;
  demo?: boolean;
  hideDemoTitle?: boolean;
}

const SessionTimeline: React.FC<SessionTimelineProps> = ({
  teamId = "demo-team",
  appId = "demo-app",
  sessionTimeline = demoTimeline,
  demo = false,
  hideDemoTitle = false,
}) => {
  const { theme } = useTheme();
  const chartColor = useChartColor();
  const chartColors = useChartColors();

  // Since we use canvas charts here, we can't use CSS variables and have to hardcode colors based on theme.
  // These colors should be the same as --foreground for each theme in globals.css
  const canvasChartTheme = {
    text: {
      fill:
        theme === "dark" ? "oklch(0.985 0 0)" : "oklch(0.141 0.005 285.823)",
    },
    axis: {
      ticks: {
        text: {
          fill:
            theme === "dark"
              ? "oklch(0.985 0 0)"
              : "oklch(0.141 0.005 285.823)",
        },
      },
    },
    legends: {
      text: {
        fill:
          theme === "dark" ? "oklch(0.985 0 0)" : "oklch(0.141 0.005 285.823)",
      },
    },
  };

  const { events, threads, eventTypes } = useMemo(() => {
    const events: {
      eventType: string;
      timestamp: string;
      thread: string;
      details: any;
    }[] = [];
    const threadsSet = new Set<string>();
    const eventTypesSet = new Set<string>();
    const traceEventType = "trace";

    Object.keys(sessionTimeline.threads).forEach((item) =>
      // @ts-ignore
      sessionTimeline.threads[item].forEach((subItem: any) => {
        events.push({
          eventType: subItem.event_type,
          timestamp: subItem.timestamp,
          thread: item,
          details: subItem,
        });
        threadsSet.add(item);
        eventTypesSet.add(subItem.event_type);
      }),
    );

    if (sessionTimeline.traces !== null) {
      eventTypesSet.add(traceEventType);
      sessionTimeline.traces.forEach((item: any) => {
        events.push({
          eventType: traceEventType,
          timestamp: item.start_time,
          thread: item.thread_name,
          details: item,
        });

        threadsSet.add(item.thread_name);
      });
    }

    events.sort((a, b) => {
      const dateA = DateTime.fromISO(a.timestamp, { zone: "utc" });
      const dateB = DateTime.fromISO(b.timestamp, { zone: "utc" });

      return dateA.toMillis() - dateB.toMillis();
    });

    return {
      events,
      threads: Array.from(threadsSet),
      eventTypes: Array.from(eventTypesSet),
    };
  }, [sessionTimeline]);

  const firstEventTime =
    events.length > 0 ? DateTime.fromISO(events[0].timestamp) : null;
  const lastEventTime =
    events.length > 0
      ? DateTime.fromISO(events[events.length - 1].timestamp)
      : null;

  // Metric samples (CPU/memory) can end before the last event, leaving the
  // plot area empty on the right. Carry the last known value forward so the
  // line visually extends to the chart's right edge.
  function padDataToLastEventTime<Y>(
    data: { x: string; y: Y }[],
  ): { x: string; y: Y }[] {
    if (data.length === 0 || events.length === 0) {
      return data;
    }
    const lastEventChartX = formatTimestampToChartFormat(
      events[events.length - 1].timestamp,
    );
    const last = data[data.length - 1];
    if (last.x === lastEventChartX) {
      return data;
    }
    return [...data, { x: lastEventChartX, y: last.y }];
  }

  function isWithinEventTimeRange(timestamp: string): boolean {
    // If no events, consider it as within range
    if (firstEventTime == null || lastEventTime == null) {
      return true;
    }
    const time = DateTime.fromISO(timestamp);
    if (time >= firstEventTime && time <= lastEventTime) {
      return true;
    }
    return false;
  }

  const cpuData =
    sessionTimeline.cpu_usage != null
      ? [
          {
            id: "% CPU Usage",
            data: sessionTimeline.cpu_usage
              .filter((item) => isWithinEventTimeRange(item.timestamp))
              .map((item) => ({
                x: formatTimestampToChartFormat(item.timestamp),
                y: item.value,
              })),
          },
        ]
      : null;

  const memoryData =
    sessionTimeline.memory_usage != null
      ? [
          {
            id: "Java Free Heap",
            seriesColor: chartColor.violet,
            data: sessionTimeline.memory_usage
              .filter((item) => isWithinEventTimeRange(item.timestamp))
              .map((item) => ({
                x: formatTimestampToChartFormat(item.timestamp),
                y: kilobytesToMegabytes(item.java_free_heap).toFixed(2),
              })),
          },
          {
            id: "Java Max Heap",
            seriesColor: chartColor.red,
            data: sessionTimeline.memory_usage
              .filter((item) => isWithinEventTimeRange(item.timestamp))
              .map((item) => ({
                x: formatTimestampToChartFormat(item.timestamp),
                y: kilobytesToMegabytes(item.java_max_heap).toFixed(2),
              })),
          },
          {
            id: "Java Total Heap",
            seriesColor: chartColor.yellow,
            data: sessionTimeline.memory_usage
              .filter((item) => isWithinEventTimeRange(item.timestamp))
              .map((item) => ({
                x: formatTimestampToChartFormat(item.timestamp),
                y: kilobytesToMegabytes(item.java_total_heap).toFixed(2),
              })),
          },
          {
            id: "Native Free Heap",
            seriesColor: chartColor.amber,
            data: sessionTimeline.memory_usage
              .filter((item) => isWithinEventTimeRange(item.timestamp))
              .map((item) => ({
                x: formatTimestampToChartFormat(item.timestamp),
                y: kilobytesToMegabytes(item.native_free_heap).toFixed(2),
              })),
          },
          {
            id: "Native Total Heap",
            seriesColor: chartColor.teal,
            data: sessionTimeline.memory_usage
              .filter((item) => isWithinEventTimeRange(item.timestamp))
              .map((item) => ({
                x: formatTimestampToChartFormat(item.timestamp),
                y: kilobytesToMegabytes(item.native_total_heap).toFixed(2),
              })),
          },
          {
            id: "RSS",
            seriesColor: chartColor.green,
            data: sessionTimeline.memory_usage
              .filter((item) => isWithinEventTimeRange(item.timestamp))
              .map((item) => ({
                x: formatTimestampToChartFormat(item.timestamp),
                y: kilobytesToMegabytes(item.rss).toFixed(2),
              })),
          },
          {
            id: "Total PSS",
            seriesColor: chartColor.pink,
            data: sessionTimeline.memory_usage
              .filter((item) => isWithinEventTimeRange(item.timestamp))
              .map((item) => ({
                x: formatTimestampToChartFormat(item.timestamp),
                y: kilobytesToMegabytes(item.total_pss).toFixed(2),
              })),
          },
        ]
      : null;

  const memoryAbsData =
    sessionTimeline.memory_usage_absolute != null
      ? [
          {
            id: "Max Memory",
            seriesColor: chartColor.violet,
            data: sessionTimeline.memory_usage_absolute
              .filter((item) => isWithinEventTimeRange(item.timestamp))
              .map((item) => ({
                x: formatTimestampToChartFormat(item.timestamp),
                y: kilobytesToMegabytes(item.max_memory).toFixed(2),
              })),
          },
          {
            id: "Used Memory",
            seriesColor: chartColor.red,
            data: sessionTimeline.memory_usage_absolute
              .filter((item) => isWithinEventTimeRange(item.timestamp))
              .map((item) => ({
                x: formatTimestampToChartFormat(item.timestamp),
                y: kilobytesToMegabytes(item.used_memory).toFixed(2),
              })),
          },
        ]
      : null;

  for (const series of cpuData ?? []) {
    series.data = padDataToLastEventTime(series.data);
  }
  for (const series of memoryData ?? []) {
    series.data = padDataToLastEventTime(series.data);
  }
  for (const series of memoryAbsData ?? []) {
    series.data = padDataToLastEventTime(series.data);
  }

  function roundUpToNiceMemoryValue(memory: number): number {
    if (memory < 1000) {
      return Math.ceil(memory / 100) * 100;
    } else if (memory < 1_000_000) {
      return Math.ceil(memory / 1000) * 1000;
    } else if (memory < 1_000_000_000) {
      return Math.ceil(memory / 1_000_000) * 1_000_000;
    } else {
      return Math.ceil(memory / 1_000_000_000) * 1_000_000_000;
    }
  }

  const createMemoryDataLookup = () => {
    if (!memoryData) {
      return { lookup: null, maxValue: 0 };
    }

    const lookup = new Map();
    let maxValue = 0;

    const filteredMemoryUsage = sessionTimeline.memory_usage.filter((item) =>
      isWithinEventTimeRange(item.timestamp),
    );
    filteredMemoryUsage.forEach((item) => {
      const formattedTimestamp = formatTimestampToChartFormat(item.timestamp);
      const values = {
        "Java Free Heap": kilobytesToMegabytes(item.java_free_heap).toFixed(2),
        "Java Max Heap": kilobytesToMegabytes(item.java_max_heap).toFixed(2),
        "Java Total Heap": kilobytesToMegabytes(item.java_total_heap).toFixed(
          2,
        ),
        "Native Free Heap": kilobytesToMegabytes(item.native_free_heap).toFixed(
          2,
        ),
        "Native Total Heap": kilobytesToMegabytes(
          item.native_total_heap,
        ).toFixed(2),
        RSS: kilobytesToMegabytes(item.rss).toFixed(2),
        "Total PSS": kilobytesToMegabytes(item.total_pss).toFixed(2),
      };

      for (const val of Object.values(values)) {
        const numVal = parseFloat(val);
        if (numVal > maxValue) {
          maxValue = numVal;
        }
      }

      lookup.set(formattedTimestamp, values);
    });

    return { lookup, maxValue: roundUpToNiceMemoryValue(maxValue) };
  };

  const { lookup: memoryDataLookup, maxValue: maxMemoryDataValue } =
    createMemoryDataLookup();

  const createMemoryAbsDataLookup = () => {
    if (!memoryAbsData) {
      return { lookup: null, maxValue: 0 };
    }

    const lookup = new Map();
    let maxValue = 0;

    const filteredMemoryUsage = sessionTimeline.memory_usage_absolute.filter(
      (item) => isWithinEventTimeRange(item.timestamp),
    );
    filteredMemoryUsage.forEach((item) => {
      const formattedTimestamp = formatTimestampToChartFormat(item.timestamp);
      const values = {
        "Max Memory": kilobytesToMegabytes(item.max_memory).toFixed(2),
        "Used Memory": kilobytesToMegabytes(item.used_memory).toFixed(2),
      };

      for (const val of Object.values(values)) {
        const numVal = parseFloat(val);
        if (numVal > maxValue) {
          maxValue = numVal;
        }
      }

      lookup.set(formattedTimestamp, values);
    });

    return { lookup, maxValue: roundUpToNiceMemoryValue(maxValue) };
  };

  const { lookup: memoryAbsDataLookup, maxValue: maxMemoryAbsDataValue } =
    createMemoryAbsDataLookup();

  const stickyRef = useRef<HTMLDivElement | null>(null);
  const eventRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [selectedThreads, setSelectedThreads] = useState(threads);
  const [selectedEventTypes, setSelectedEventTypes] = useState(eventTypes);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [indicatorTimestamp, setIndicatorTimestamp] = useState<string | null>(
    events.length > 0 ? events[0].timestamp : null,
  );

  function eventKey(e: {
    eventType: string;
    timestamp: string;
    thread: string;
  }) {
    return `${e.eventType}|${e.thread}|${e.timestamp}`;
  }

  const toggleExpansion = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          selectedThreads.includes(e.thread) &&
          selectedEventTypes.includes(e.eventType),
      ),
    [events, selectedThreads, selectedEventTypes],
  );

  // Clear the scroll indicator when there are no events to point at.
  if (filteredEvents.length === 0 && indicatorTimestamp !== null) {
    setIndicatorTimestamp(null);
  }

  useEffect(() => {
    if (filteredEvents.length === 0) {
      return;
    }

    let rafId: number | null = null;

    const updateIndicator = () => {
      rafId = null;
      const stickyBottom =
        stickyRef.current?.getBoundingClientRect().bottom ?? 0;
      const refs = eventRefs.current;
      for (let i = 0; i < refs.length; i++) {
        const el = refs[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.bottom >= stickyBottom - 1) {
          setIndicatorTimestamp(filteredEvents[i].timestamp);
          return;
        }
      }
      setIndicatorTimestamp(
        filteredEvents[filteredEvents.length - 1].timestamp,
      );
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(updateIndicator);
    };

    updateIndicator();
    window.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [filteredEvents, expandedKeys]);

  const indicatorPercent =
    indicatorTimestamp && firstEventTime && lastEventTime
      ? Math.max(
          0,
          Math.min(
            1,
            DateTime.fromISO(indicatorTimestamp)
              .diff(firstEventTime)
              .toMillis() /
              Math.max(1, lastEventTime.diff(firstEventTime).toMillis()),
          ),
        )
      : null;

  const chartMargin = { top: 10, right: 16, bottom: 28, left: 64 };
  const indicatorStyle: React.CSSProperties | null =
    indicatorPercent === null
      ? null
      : {
          top: `${chartMargin.top}px`,
          bottom: `${chartMargin.bottom}px`,
          left: `calc(${chartMargin.left}px + (100% - ${chartMargin.left + chartMargin.right}px) * ${indicatorPercent})`,
        };

  const xScaleMin =
    events.length > 0
      ? DateTime.fromISO(events[0].timestamp).toLocal().toJSDate()
      : ("auto" as const);
  const xScaleMax =
    events.length > 0
      ? DateTime.fromISO(events[events.length - 1].timestamp)
          .toLocal()
          .toJSDate()
      : ("auto" as const);

  const renderIndicator = () =>
    indicatorStyle && (
      <div
        className="absolute pointer-events-none border-l-2 border-dashed border-foreground/70 z-[1]"
        style={indicatorStyle}
      />
    );

  return (
    <div className={`flex flex-col w-full font-body`}>
      {demo && !hideDemoTitle && (
        <>
          <p className="font-display text-4xl max-w-6xl text-start">
            Session Timeline
          </p>
          <div className="py-2" />
        </>
      )}
      <div className="flex flex-wrap gap-2 py-2 pb-4 items-center">
        <Pill
          tooltip
        >{`User ID: ${sessionTimeline.attribute.user_id !== "" ? sessionTimeline.attribute.user_id : "N/A"}`}</Pill>
        <Pill
          tooltip
        >{`Duration: ${formatMillisToHumanReadable(sessionTimeline.duration as unknown as number)}`}</Pill>
        <Pill
          tooltip
        >{`Device: ${sessionTimeline.attribute.device_manufacturer + sessionTimeline.attribute.device_model}`}</Pill>
        <Pill
          tooltip
        >{`App version: ${sessionTimeline.attribute.app_version} (${sessionTimeline.attribute.app_build})`}</Pill>
        <Pill
          tooltip
        >{`Network type: ${sessionTimeline.attribute.network_type}`}</Pill>
      </div>

      {/* Sticky region: charts + filters stay pinned while events scroll. The
          offset differs by scroll context: the real page (demo=false) pins
          below the app header (top-16), while demos pin inside a padded
          scroll container, so -top-12 cancels its top padding to keep the
          charts flush with the top. */}
      <div
        ref={stickyRef}
        className={`sticky ${demo ? "-top-12" : "top-16"} z-40 bg-background`}
      >
        {(cpuData != null || memoryData != null || memoryAbsData != null) && (
          <div className="flex flex-col pt-2">
            {cpuData != null && (
              <div className="relative select-none w-full h-24">
                <ResponsiveLineCanvas
                  data={cpuData}
                  curve="monotoneX"
                  theme={canvasChartTheme}
                  margin={chartMargin}
                  xFormat="time:%Y-%m-%d %I:%M:%S:%L %p"
                  xScale={{
                    format: "%Y-%m-%d %I:%M:%S:%L %p",
                    precision: "millisecond",
                    type: "time",
                    min: xScaleMin,
                    max: xScaleMax,
                    useUTC: false,
                  }}
                  yScale={{ type: "linear", min: 0, max: 100 }}
                  yFormat=" >-.2f"
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    format: "%-I:%M:%S",
                    legendPosition: "middle",
                    tickRotation: 0,
                    tickValues: 4,
                  }}
                  axisLeft={{
                    tickSize: 1,
                    tickPadding: 5,
                    tickValues: 3,
                    legend: "% CPU",
                    legendOffset: -52,
                    legendPosition: "middle",
                  }}
                  colors={chartColors}
                  pointSize={0}
                  enableGridX={false}
                  enableGridY={false}
                  tooltip={({ point }) => (
                    <PlotTooltipShell>
                      <p>
                        Time:{" "}
                        {formatChartFormatTimestampToHumanReadable(
                          point.data.xFormatted.toString(),
                        )}
                      </p>
                      <div className="flex flex-row items-center gap-2 mt-2">
                        <PlotTooltipSwatch color={point.seriesColor} />
                        <p>Cpu Usage: {point.data.yFormatted.toString()}%</p>
                      </div>
                    </PlotTooltipShell>
                  )}
                />
                {renderIndicator()}
              </div>
            )}
            {memoryData != null && (
              <div className="relative select-none w-full h-24">
                <ResponsiveLineCanvas
                  data={memoryData}
                  curve="monotoneX"
                  theme={canvasChartTheme}
                  margin={chartMargin}
                  xFormat="time:%Y-%m-%d %H:%M:%S:%L %p"
                  xScale={{
                    format: "%Y-%m-%d %I:%M:%S:%L %p",
                    precision: "millisecond",
                    type: "time",
                    min: xScaleMin,
                    max: xScaleMax,
                    useUTC: false,
                  }}
                  yScale={{ type: "linear", min: 0, max: maxMemoryDataValue }}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    format: "%-I:%M:%S",
                    legendPosition: "middle",
                    tickRotation: 0,
                    tickValues: 4,
                  }}
                  axisLeft={{
                    tickSize: 1,
                    tickPadding: 5,
                    tickValues: 3,
                    legend: "Memory MB",
                    legendOffset: -52,
                    legendPosition: "middle",
                  }}
                  colors={{ datum: "seriesColor" }}
                  pointSize={0}
                  enableGridX={false}
                  enableGridY={false}
                  tooltip={({ point }) => {
                    if (!memoryDataLookup) return null;
                    const allMemoryData =
                      memoryDataLookup.get(point.data.xFormatted) || {};
                    return (
                      <PlotTooltipShell className="py-4">
                        <p>
                          Time:{" "}
                          {formatChartFormatTimestampToHumanReadable(
                            point.data.xFormatted.toString(),
                          )}
                        </p>
                        <div className="py-1" />
                        {Object.entries(allMemoryData).map(
                          ([seriesName, value]) => (
                            <div
                              key={seriesName}
                              className="flex flex-row items-center gap-2 mt-2"
                            >
                              <PlotTooltipSwatch
                                color={
                                  memoryData.find((it) => it.id === seriesName)!
                                    .seriesColor
                                }
                              />
                              <p>
                                {seriesName}: {value as string} MB
                              </p>
                            </div>
                          ),
                        )}
                      </PlotTooltipShell>
                    );
                  }}
                />
                {renderIndicator()}
              </div>
            )}
            {memoryAbsData != null && (
              <div className="relative select-none w-full h-24">
                <ResponsiveLineCanvas
                  data={memoryAbsData}
                  curve="monotoneX"
                  theme={canvasChartTheme}
                  margin={chartMargin}
                  xFormat="time:%Y-%m-%d %H:%M:%S:%L %p"
                  xScale={{
                    format: "%Y-%m-%d %I:%M:%S:%L %p",
                    precision: "millisecond",
                    type: "time",
                    min: xScaleMin,
                    max: xScaleMax,
                    useUTC: false,
                  }}
                  yScale={{
                    type: "linear",
                    min: 0,
                    max: maxMemoryAbsDataValue,
                  }}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    format: "%-I:%M:%S",
                    legendPosition: "middle",
                    tickRotation: 0,
                    tickValues: 4,
                  }}
                  axisLeft={{
                    tickSize: 1,
                    tickPadding: 5,
                    tickValues: 3,
                    legend: "Memory MB",
                    legendOffset: -52,
                    legendPosition: "middle",
                  }}
                  colors={{ datum: "seriesColor" }}
                  pointSize={0}
                  enableGridX={false}
                  enableGridY={false}
                  tooltip={({ point }) => {
                    if (!memoryAbsDataLookup) return null;
                    const allMemoryData =
                      memoryAbsDataLookup.get(point.data.xFormatted) || {};
                    return (
                      <PlotTooltipShell className="py-4">
                        <p>
                          Time:{" "}
                          {formatChartFormatTimestampToHumanReadable(
                            point.data.xFormatted.toString(),
                          )}
                        </p>
                        <div className="py-1" />
                        {Object.entries(allMemoryData).map(
                          ([seriesName, value]) => (
                            <div
                              key={seriesName}
                              className="flex flex-row items-center gap-2 mt-2"
                            >
                              <PlotTooltipSwatch
                                color={
                                  memoryAbsData.find(
                                    (it) => it.id === seriesName,
                                  )!.seriesColor
                                }
                              />
                              <p>
                                {seriesName}: {value as string} MB
                              </p>
                            </div>
                          ),
                        )}
                      </PlotTooltipShell>
                    );
                  }}
                />
                {renderIndicator()}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-4 items-center py-3">
          <DropdownSelect
            type={DropdownSelectType.MultiString}
            title="Threads"
            items={threads}
            initialSelected={selectedThreads}
            onChangeSelected={(items) => setSelectedThreads(items as string[])}
          />
          <DropdownSelect
            type={DropdownSelectType.MultiString}
            title="Event types"
            items={eventTypes}
            initialSelected={selectedEventTypes}
            onChangeSelected={(items) =>
              setSelectedEventTypes(items as string[])
            }
          />
        </div>
      </div>

      {/* Events list — natural page-level scroll, no fixed height. */}
      <div className="flex flex-col w-full">
        {filteredEvents.map((e, index) => {
          const key = eventKey(e);
          return (
            <div
              key={key}
              ref={(el) => {
                eventRefs.current[index] = el;
              }}
            >
              <SessionTimelineEventCell
                teamId={teamId}
                appId={appId}
                demo={demo}
                eventType={e.eventType}
                eventDetails={e.details}
                timestamp={e.timestamp}
                threadName={e.thread}
                expanded={expandedKeys.has(key)}
                onToggle={() => toggleExpansion(key)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SessionTimeline;
