"use client";

import React, { useMemo, useState } from "react";
import { ExceptionsType } from "../api/api_calls";
import {
  type ExceptionGroupCommonPath,
  useExceptionGroupCommonPathQuery,
} from "../query/hooks";
import BetaBadge from "./beta_badge";
import CodeBlock from "./code_block";
import { Skeleton } from "./skeleton";
import { Slider } from "./slider";

const demoExceptionGroupCommonPath: ExceptionGroupCommonPath = {
  sessions_analyzed: 50,
  steps: [
    {
      description: "App moved to foreground",
      thread_name: "main",
      confidence_pct: 80.5,
    },
    {
      description: "Activity resumed: sh.measure.demo.CheckoutActivity",
      thread_name: "main",
      confidence_pct: 80.5,
    },
    {
      description:
        "HTTP GET: https://payments.demo-provider.com/demo-user-id/payment-methods",
      thread_name: "okhttp",
      confidence_pct: 100,
    },
    {
      description:
        "User tapped on btn_payment_type (com.google.android.material.button.MaterialButton)",
      thread_name: "main",
      confidence_pct: 5.11,
    },
    {
      description:
        "User tapped on tab_select_discount (com.google.android.material.button.MaterialButton)",
      thread_name: "main",
      confidence_pct: 53.8,
    },
    {
      description:
        "User tapped on btn_order_summary (com.google.android.material.button.MaterialButton)",
      thread_name: "main",
      confidence_pct: 34.3,
    },
    {
      description:
        "User tapped on btn_pay (com.google.android.material.button.MaterialButton)",
      thread_name: "main",
      confidence_pct: 100,
    },
    {
      description:
        "Crash: java.lang.IllegalStateException -  Payment method must be specified",
      thread_name: "main",
      confidence_pct: 100,
    },
  ],
};

interface ExceptionGroupCommonPathProps {
  type: ExceptionsType;
  appId: string;
  groupId: string;
  demo?: boolean;
}

const ExceptionGroupCommonPath: React.FC<ExceptionGroupCommonPathProps> = ({
  type,
  appId,
  groupId,
  demo = false,
}) => {
  const { data: queryCommonPath, status: queryStatus } =
    useExceptionGroupCommonPathQuery(
      type,
      demo ? "" : appId,
      demo ? "" : groupId,
    );

  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(80);

  const commonPathStatus = demo ? "success" : queryStatus;
  const exceptionsGroupCommonPath = demo
    ? demoExceptionGroupCommonPath
    : queryCommonPath;

  // Filter steps based on confidence threshold
  const filteredSteps = useMemo(() => {
    if (!exceptionsGroupCommonPath?.steps) {
      return [];
    }
    return exceptionsGroupCommonPath.steps.filter(
      (step) => step.confidence_pct >= confidenceThreshold,
    );
  }, [exceptionsGroupCommonPath, confidenceThreshold]);

  return (
    <div className="flex flex-col font-body w-full">
      <p className="text-3xl">
        Common Path <BetaBadge />
      </p>
      {commonPathStatus === "pending" && (
        <div className="py-4 flex flex-col gap-3 w-full">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-[24rem] w-full rounded-sm" />
        </div>
      )}
      {commonPathStatus === "error" && (
        <p className="font-display py-4">
          Error fetching common path, please refresh page to try again
        </p>
      )}
      {commonPathStatus === "success" && (
        <div className="flex flex-col w-full">
          {/* Confidence Filter */}
          <div className="py-3" />
          <div className="flex flex-col gap-6">
            <div className="flex items-center text-muted-foreground justify-between">
              <label className="text-sm">
                Showing events that are common in at least:{" "}
                <span className="font-semibold">{confidenceThreshold}%</span> of
                analyzed sessions
              </label>
              <span className="text-xs">
                Analyzed from latest{" "}
                {exceptionsGroupCommonPath?.sessions_analyzed} sessions |{" "}
                {filteredSteps.length} of{" "}
                {exceptionsGroupCommonPath?.steps.length} steps
              </span>
            </div>
            <Slider
              value={[confidenceThreshold]}
              onValueChange={(value) => setConfidenceThreshold(value[0])}
              min={1}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <div className="py-4" />
          <div className="w-full border border-border rounded-sm h-[24rem] overflow-y-auto p-4">
            {filteredSteps.length === 0 ? (
              <p className="text-center text-sm w-full py-24 text-muted-foreground">
                No events are common in at least {confidenceThreshold}% of
                analyzed sessions
              </p>
            ) : (
              <ol className="list-decimal list-outside space-y-6 ml-8 marker:text-muted-foreground">
                {filteredSteps.map((stepInfo, index) => (
                  <li key={index} className="pl-2">
                    <CodeBlock
                      code={stepInfo.description}
                      language="java"
                      className="font-code text-sm rounded-sm overflow-hidden [&_pre]:px-3 [&_pre]:py-2 [&_pre]:overflow-x-auto"
                    />
                    <p className="text-xs pt-1.5 pl-3 text-muted-foreground">
                      Thread: {stepInfo.thread_name} | Occurs in{" "}
                      {stepInfo.confidence_pct}% of analyzed sessions
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExceptionGroupCommonPath;
