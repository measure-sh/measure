import { ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { underlineLinkStyle } from "../utils/shared_styles";
import { SUPPORT_URL } from "../utils/support";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

interface OnboardingWaitingProps {
  apiKey: string;
  apiUrl: string;
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="font-code text-xs bg-muted px-1 py-0.5 rounded wrap-break-word">
      {children}
    </code>
  );
}

export default function OnboardingWaiting({
  apiKey,
  apiUrl,
}: OnboardingWaitingProps) {
  const tips: { id: string; content: ReactNode }[] = [
    {
      id: "restart",
      content: <>Restart the app.</>,
    },
    {
      id: "api-key",
      content: (
        <>
          Check that your app uses the API key <Code>{apiKey}</Code> and API URL{" "}
          <Code>{apiUrl}</Code>.
        </>
      ),
    },
    {
      id: "native-integration",
      content: (
        <>
          If this is a React Native, Flutter or Kotlin Multiplatform app, make
          sure you’ve completed the native integration steps.
        </>
      ),
    },
    {
      id: "network",
      content: (
        <>
          Check that a firewall, VPN or network policy does not block{" "}
          <Code>{apiUrl}</Code>.
        </>
      ),
    },
    {
      id: "logging",
      content: (
        <>
          On Android, enable logging with <Code>enableLogging = true</Code> in{" "}
          <Code>MeasureConfig</Code>, then check the <Code>Measure</Code> tag in
          Logcat. On iOS, enable it with <Code>enableLogging: true</Code> in{" "}
          <Code>BaseMeasureConfig</Code>, then check the Xcode console. Look for
          errors about the SDK starting or sending data.
        </>
      ),
    },
    {
      id: "support",
      content: (
        <>
          Still having trouble?{" "}
          <Link
            href={SUPPORT_URL}
            target="_blank"
            className={underlineLinkStyle}
          >
            Contact us
          </Link>
          .
        </>
      ),
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden font-body">
      <div className="flex flex-row items-center gap-3 p-5">
        <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
        <p className="font-display text-lg">
          Waiting for your first crash to show up…
        </p>
      </div>
      <Collapsible className="border-t border-border bg-muted/30">
        <CollapsibleTrigger className="group flex flex-row w-full items-center justify-between px-5 py-3 text-sm text-muted-foreground hover:text-foreground cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          No crash yet?
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="flex flex-col gap-3 px-5 pb-5 pt-1 text-sm">
            {tips.map((tip, i) => (
              <li key={tip.id} className="flex flex-row gap-3">
                <span className="flex items-center justify-center size-5 shrink-0 rounded-full bg-muted font-display text-xs text-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0">{tip.content}</span>
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
