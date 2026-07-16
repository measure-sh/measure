"use client";

import { cn } from "@/app/utils/shadcn_utils";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { MessageCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { AISearch, AISearchPanel, AISearchTrigger } from "./search";

/**
 * Mounts the Ask AI chat only when the server has an LLM key
 * configured: the /docs/chat GET probe answers 204 when enabled and 404
 * otherwise, so unconfigured self-hosted deployments never show the button.
 */
export default function AskAI() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/docs/chat", { method: "GET" })
      .then((res) => {
        if (!cancelled) {
          setEnabled(res.ok);
        }
      })
      .catch(() => {
        // probe failures leave the chat hidden
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <AISearch>
      <AISearchPanel />
      <AISearchTrigger
        position="float"
        className={cn(
          buttonVariants({
            color: "secondary",
            className: "text-fd-muted-foreground rounded-2xl",
          }),
        )}
      >
        <MessageCircleIcon className="size-4.5" />
        Ask AI
      </AISearchTrigger>
    </AISearch>
  );
}
