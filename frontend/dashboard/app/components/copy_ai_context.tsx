import React from 'react';
import { emptyAnrExceptionsDetailsResponse, emptyCrashExceptionsDetailsResponse, ExceptionsType } from '../api/api_calls';
import { formatDateToHumanReadableDateTime } from '../utils/time_utils';

interface CopyAiContextProps {
  appName: string,
  exceptionsType: ExceptionsType
  exceptionsDetails: typeof emptyCrashExceptionsDetailsResponse | typeof emptyAnrExceptionsDetailsResponse
}

const CopyAiContext: React.FC<CopyAiContextProps> = ({ appName, exceptionsType, exceptionsDetails }) => {
  const formatExceptionDetails = () => {
    let formatted = ""

    formatted = formatted + "App Name: " + appName + "\n"
    formatted = formatted + "App version: " + exceptionsDetails.results[0].attribute.app_version + "\n"
    formatted = formatted + "Date & time: " + formatDateToHumanReadableDateTime(exceptionsDetails.results[0].timestamp) + "\n"
    formatted = formatted + "Platform: " + exceptionsDetails.results[0].attribute.platform + "\n"
    formatted = formatted + "Device: " + exceptionsDetails.results[0].attribute.device_manufacturer + exceptionsDetails.results[0].attribute.device_model + "\n"
    formatted = formatted + "Network type: " + exceptionsDetails.results[0].attribute.network_type + "\n"

    formatted = formatted + "\nSTACK TRACES:\n"
    let stacktrace = exceptionsType === ExceptionsType.Crash ? (exceptionsDetails as typeof emptyCrashExceptionsDetailsResponse).results[0].exception.stacktrace : (exceptionsDetails as typeof emptyAnrExceptionsDetailsResponse).results[0].anr.stacktrace
    let indentedStackTrace = stacktrace.split("\n").map(line => "    " + line).join("\n")

    formatted = formatted + "Thread: " + exceptionsDetails.results[0].attribute.thread_name + "\nStacktrace:\n" + indentedStackTrace + "\n\n"

    exceptionsDetails.results[0].threads.forEach((e) => {
      formatted = formatted + "Thread: " + e.name + "\n"
      formatted = formatted + "Stacktrace:\n    " + e.frames.join("\n    ")
      formatted = formatted + "\n\n"
    })

    return formatted
  }

  const llmContext =
    "I am trying to fix an exception in my app. The details are as follows: \n\n"
    + formatExceptionDetails() + "\n\n"
    + "Please help me debug this."

  return (
    <button className="flex group relative outline-hidden justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display transition-colors duration-100 py-2 px-4" onClick={() => navigator.clipboard.writeText(llmContext)}>
      Copy AI Context
      <span className="pointer-events-none z-50 max-w-xl absolute font-body text-sm text-white rounded-md p-2 bg-neutral-800 -bottom-12 left-0 w-max opacity-0 transition-opacity group-hover:opacity-100">
        Copy full exception context for easy pasting in your favorite LLM
      </span>
    </button>
  );
}

export default CopyAiContext;