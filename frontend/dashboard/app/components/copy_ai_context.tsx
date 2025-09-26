import { LucideCopy } from 'lucide-react'
import React from 'react'
import { emptyAnrExceptionsDetailsResponse, emptyCrashExceptionsDetailsResponse, ExceptionsType } from '../api/api_calls'
import { formatDateToHumanReadableDateTime } from '../utils/time_utils'
import { toastPositive } from '../utils/use_toast'
import { Button } from './button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

interface CopyAiContextProps {
  appName: string,
  exceptionsType: ExceptionsType
  exceptionsDetails: typeof emptyCrashExceptionsDetailsResponse | typeof emptyAnrExceptionsDetailsResponse
}

function createExceptionLLMContext(params: {
  appName: string;
  exceptionsType: ExceptionsType;
  exceptionsDetails: typeof emptyCrashExceptionsDetailsResponse | typeof emptyAnrExceptionsDetailsResponse;
}): string {
  const { appName, exceptionsType, exceptionsDetails } = params;

  let formatted = "";

  formatted += `App Name: ${appName}\n`;
  formatted += `App version: ${exceptionsDetails.results[0].attribute.app_version}\n`;
  formatted += `Date & time: ${formatDateToHumanReadableDateTime(exceptionsDetails.results[0].timestamp)}\n`;
  formatted += `Platform: ${exceptionsDetails.results[0].attribute.platform}\n`;
  formatted += `Device: ${exceptionsDetails.results[0].attribute.device_manufacturer} ${exceptionsDetails.results[0].attribute.device_model}\n`;
  formatted += `Network type: ${exceptionsDetails.results[0].attribute.network_type}\n`;

  formatted += "\nSTACK TRACES:\n";
  const stacktrace =
    exceptionsType === ExceptionsType.Crash
      ? (exceptionsDetails as typeof emptyCrashExceptionsDetailsResponse).results[0].exception.stacktrace
      : (exceptionsDetails as typeof emptyAnrExceptionsDetailsResponse).results[0].anr.stacktrace;
  const indentedStackTrace = stacktrace.split("\n").map(line => "    " + line).join("\n");

  formatted += `Thread: ${exceptionsDetails.results[0].attribute.thread_name}\nStacktrace:\n${indentedStackTrace}\n\n`;

  if (exceptionsDetails.results[0].threads) {
    exceptionsDetails.results[0].threads.forEach((e) => {
      formatted += `Thread: ${e.name}\n`;
      formatted += `Stacktrace:\n    ${e.frames.join("\n    ")}\n\n`;
    });
  }

  return (
    "I am trying to fix an exception in my app. The details are as follows: \n\n" +
    formatted +
    "\n\nPlease help me debug this."
  );
}

const CopyAiContext: React.FC<CopyAiContextProps> = ({ appName, exceptionsType, exceptionsDetails }) => {
  const llmContext = createExceptionLLMContext({
    appName,
    exceptionsType,
    exceptionsDetails
  })

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          className="font-display border border-black select-none"
          onClick={() => {
            navigator.clipboard.writeText(llmContext)
            toastPositive("AI context copied to clipboard")
          }}
        >
          <LucideCopy className="h-4 w-4" />
          Copy AI Context
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="font-display text-sm text-white fill-bg-neutral-800 bg-neutral-800">
        Copy full exception context for easy pasting in your favorite LLM
      </TooltipContent>
    </Tooltip>
  )
}

export default CopyAiContext