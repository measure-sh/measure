"use client";

import { Button } from "@/app/components/button";
import { useState } from "react";
import { type McpParams } from "../params";

const consentAction = "/auth/mcp/consent";

function Fields({ params, decision }: { params: McpParams; decision: string }) {
  return (
    <>
      {Object.entries(params).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="decision" value={decision} />
    </>
  );
}

function ProviderForm(props: {
  params: McpParams;
  provider: string;
  label: string;
  shared: string;
}) {
  return (
    <form method="post" action={consentAction} className="space-y-2">
      <Fields params={props.params} decision="allow" />
      <input type="hidden" name="provider" value={props.provider} />
      <Button
        type="submit"
        variant="outline"
        size="lg"
        className="justify-center w-full font-display border-2 border-border"
      >
        {props.label}
      </Button>
      <p className="font-body text-center text-xs text-muted-foreground">
        Shares {props.shared}
      </p>
    </form>
  );
}

export default function ConsentActions({ params }: { params: McpParams }) {
  const [allowed, setAllowed] = useState(false);

  if (allowed) {
    return (
      <div className="space-y-4">
        <ProviderForm
          params={params}
          provider="github"
          label="Continue with GitHub"
          shared="your email address"
        />
        <ProviderForm
          params={params}
          provider="google"
          label="Continue with Google"
          shared="your name & email address"
        />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full font-display border-2 border-border"
        onClick={() => setAllowed(true)}
      >
        Allow
      </Button>
      <form method="post" action={consentAction} className="w-full">
        <Fields params={params} decision="deny" />
        <Button
          type="submit"
          variant="outline"
          size="lg"
          className="w-full font-display border-2 border-border"
        >
          Deny
        </Button>
      </form>
    </div>
  );
}
