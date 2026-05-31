import React from "react";
import { emptyErrorGroupDetails } from "../api/api_calls";
import { formatDateToHumanReadableDateTime } from "../utils/time_utils";
import { toastPositive } from "../utils/use_toast";
import { Button } from "./button";
import SimpleTooltip from "./simple_tooltip";

type ErrorEvent = (typeof emptyErrorGroupDetails)["results"][number];

interface CopyAiContextProps {
  appName: string;
  errorEvent: ErrorEvent;
}

const CopyAiContext: React.FC<CopyAiContextProps> = ({
  appName,
  errorEvent,
}) => {
  const formatErrorDetails = () => {
    let formatted = "";

    formatted = formatted + "App Name: " + appName + "\n";
    formatted =
      formatted + "App version: " + errorEvent.attribute.app_version + "\n";
    formatted =
      formatted +
      "Date & time: " +
      formatDateToHumanReadableDateTime(errorEvent.timestamp) +
      "\n";
    formatted = formatted + "Platform: " + errorEvent.attribute.platform + "\n";
    formatted =
      formatted +
      "Device: " +
      errorEvent.attribute.device_manufacturer +
      errorEvent.attribute.device_model +
      "\n";
    formatted =
      formatted + "Network type: " + errorEvent.attribute.network_type + "\n";

    formatted = formatted + "\nSTACK TRACES:\n";
    const stacktrace = errorEvent.exception
      ? (errorEvent.exception.stacktrace ?? "")
      : (errorEvent.anr?.stacktrace ?? "");
    const indentedStackTrace = stacktrace
      .split("\n")
      .map((line) => "    " + line)
      .join("\n");

    formatted =
      formatted +
      "Thread: " +
      errorEvent.attribute.thread_name +
      "\nStacktrace:\n" +
      indentedStackTrace +
      "\n\n";

    if (errorEvent.threads) {
      errorEvent.threads.forEach((e) => {
        formatted = formatted + "Thread: " + e.name + "\n";
        formatted = formatted + "Stacktrace:\n    " + e.frames.join("\n    ");
        formatted = formatted + "\n\n";
      });
    }

    return formatted;
  };

  const llmContext =
    "I am trying to fix an error in my app. The details are as follows: \n\n" +
    formatErrorDetails() +
    "\n\n" +
    "Please help me debug this.";

  return (
    <SimpleTooltip content="Copy full error context for easy pasting in your favorite LLM">
      <Button
        variant="outline"
        onClick={() => {
          navigator.clipboard.writeText(llmContext);
          toastPositive("AI context copied to clipboard");
        }}
      >
        Copy AI Context
      </Button>
    </SimpleTooltip>
  );
};

export default CopyAiContext;
