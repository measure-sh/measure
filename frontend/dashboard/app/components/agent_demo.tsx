"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const WORKSPACE_NAME = "Acme Corp";
const CHANNEL = "app-releases";
const USER_NAME = "Anne Droid";
const USER_INITIALS = "AD";
const USER_TIME = "10:02 AM";
const BOT_NAME = "Measure";
const BOT_TIME = "10:02 AM";

const Q1 = "@Measure how are crashes looking today?";
const A1 =
  "Crashes are up **12%** today, **1,284** vs 1,142 yesterday. Most of the jump is `IllegalStateException` in **CheckoutActivity** on v1.0.0, almost all on Pixel 7 Pro over Wi-Fi.";
const Q2 = "@Measure what were affected users doing?";
const A2 =
  "They tapped **Checkout** before choosing a payment method. I pulled several sessions and analyzed them for you. Average **2m 43s** from launch to crash. Repro steps:\n1. Add any item to the cart\n2. Skip choosing a payment method\n3. Tap **Checkout**\n4. Crash, `IllegalStateException` in **CheckoutActivity**";

// Heights for the little 1-day sparkline under the first answer.
const SPARKLINE = [34, 48, 40, 62, 52, 78, 100];

// Animation phase timings (ms)
const INITIAL_PAUSE = 500;
const TYPING_SPEED = 18; // per character, composer
const SEND_PAUSE = 300; // after a question posts, before the bot reacts
const BOT_TYPING = 800; // "Measure is typing…"
const RESPONSE_SPEED = 8; // per character, bot answer
const READ_PAUSE = 900; // let the first answer breathe before the follow-up
const HOLD_DURATION = 2500;
const FADE_OUT_DURATION = 400;

enum Phase {
  InitialPause,
  TypingQ1,
  SendQ1,
  BotTyping1,
  TypingA1,
  ReadA1,
  TypingQ2,
  SendQ2,
  BotTyping2,
  TypingA2,
  Hold,
  FadeOut,
}

// Render Slack-flavoured markup: **bold**, `code`, @mentions, and newlines.
function renderRich(text: string) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    if (remaining.startsWith("\n")) {
      parts.push(<br key={key++} />);
      remaining = remaining.slice(1);
      continue;
    }

    const bold = remaining.match(/^\*\*(.+?)\*\*/);
    if (bold) {
      parts.push(
        <span key={key++} className="font-bold">
          {bold[1]}
        </span>,
      );
      remaining = remaining.slice(bold[0].length);
      continue;
    }

    const code = remaining.match(/^`(.+?)`/);
    if (code) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-black/[0.06] px-1 py-0.5 font-code text-[0.85em] text-[#e01e5a] dark:bg-white/10"
        >
          {code[1]}
        </code>,
      );
      remaining = remaining.slice(code[0].length);
      continue;
    }

    const mention = remaining.match(/^@(\w+)/);
    if (mention) {
      parts.push(
        <span
          key={key++}
          className="rounded-[3px] bg-[#1264a3]/10 px-1 font-medium text-[#1264a3] dark:bg-[#6aa9e0]/15 dark:text-[#6aa9e0]"
        >
          @{mention[1]}
        </span>,
      );
      remaining = remaining.slice(mention[0].length);
      continue;
    }

    const next = remaining.search(/[*`@\n]/);
    if (next === -1) {
      parts.push(<span key={key++}>{remaining}</span>);
      remaining = "";
    } else if (next === 0) {
      parts.push(<span key={key++}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    } else {
      parts.push(<span key={key++}>{remaining.slice(0, next)}</span>);
      remaining = remaining.slice(next);
    }
  }

  return parts;
}

function UserAvatar() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-[#4a5b78] text-xs font-semibold text-white">
      {USER_INITIALS}
    </div>
  );
}

function BotAvatar() {
  return (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-[6px] bg-black ring-1 ring-black/5">
      <Image
        src="/images/measure_icon.svg"
        alt="Measure"
        fill
        sizes="36px"
        className="object-contain p-1"
      />
    </div>
  );
}

function MessageRow({
  avatar,
  name,
  time,
  isApp,
  children,
}: {
  avatar: React.ReactNode;
  name: string;
  time: string;
  isApp?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5 px-4 py-1.5 md:px-5">
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-extrabold leading-none text-[#1d1c1d] dark:text-[#d1d2d3]">
            {name}
          </span>
          {isApp && (
            <span className="rounded-[3px] bg-black/[0.08] px-1 py-px text-[10px] font-bold uppercase leading-tight tracking-wide text-[#616061] dark:bg-white/10 dark:text-[#abadb0]">
              App
            </span>
          )}
          <span className="text-xs text-[#616061] dark:text-[#abadb0]">
            {time}
          </span>
        </div>
        <div className="mt-0.5 text-[15px] leading-[1.46] text-[#1d1c1d] dark:text-[#d1d2d3]">
          {children}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-1.5 md:px-5">
      <BotAvatar />
      <div className="flex items-baseline gap-1">
        <span className="text-[13px] text-[#616061] dark:text-[#abadb0]">
          {BOT_NAME} is typing
        </span>
        <span className="flex gap-0.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-0.5 w-0.5 animate-bounce rounded-full bg-[#616061] dark:bg-[#abadb0]"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

function SidebarChannel({ name, active }: { name: string; active?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-[6px] px-2 py-1 text-[15px] ${
        active
          ? "bg-[#1164a3] text-white"
          : "text-[#cfc3cf] hover:bg-white/5 dark:text-[#bcbdbe]"
      }`}
    >
      <span
        className={
          active ? "text-white/70" : "text-[#9b8e9b] dark:text-[#8c8d8f]"
        }
      >
        #
      </span>
      <span className="truncate">{name}</span>
    </div>
  );
}

export default function AgentDemo() {
  const [phase, setPhase] = useState<Phase>(Phase.InitialPause);
  const [q1Chars, setQ1Chars] = useState(0);
  const [q2Chars, setQ2Chars] = useState(0);
  const [a1Chars, setA1Chars] = useState(0);
  const [a2Chars, setA2Chars] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view as the conversation grows.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [phase, q1Chars, q2Chars, a1Chars, a2Chars]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    switch (phase) {
      case Phase.InitialPause:
        timeout = setTimeout(() => setPhase(Phase.TypingQ1), INITIAL_PAUSE);
        break;

      case Phase.TypingQ1:
        if (q1Chars < Q1.length) {
          timeout = setTimeout(() => setQ1Chars((c) => c + 1), TYPING_SPEED);
        } else {
          timeout = setTimeout(() => setPhase(Phase.SendQ1), 120);
        }
        break;

      case Phase.SendQ1:
        timeout = setTimeout(() => setPhase(Phase.BotTyping1), SEND_PAUSE);
        break;

      case Phase.BotTyping1:
        timeout = setTimeout(() => setPhase(Phase.TypingA1), BOT_TYPING);
        break;

      case Phase.TypingA1:
        if (a1Chars < A1.length) {
          timeout = setTimeout(() => setA1Chars((c) => c + 1), RESPONSE_SPEED);
        } else {
          timeout = setTimeout(() => setPhase(Phase.ReadA1), 120);
        }
        break;

      case Phase.ReadA1:
        timeout = setTimeout(() => setPhase(Phase.TypingQ2), READ_PAUSE);
        break;

      case Phase.TypingQ2:
        if (q2Chars < Q2.length) {
          timeout = setTimeout(() => setQ2Chars((c) => c + 1), TYPING_SPEED);
        } else {
          timeout = setTimeout(() => setPhase(Phase.SendQ2), 120);
        }
        break;

      case Phase.SendQ2:
        timeout = setTimeout(() => setPhase(Phase.BotTyping2), SEND_PAUSE);
        break;

      case Phase.BotTyping2:
        timeout = setTimeout(() => setPhase(Phase.TypingA2), BOT_TYPING);
        break;

      case Phase.TypingA2:
        if (a2Chars < A2.length) {
          timeout = setTimeout(() => setA2Chars((c) => c + 1), RESPONSE_SPEED);
        } else {
          timeout = setTimeout(() => setPhase(Phase.Hold), 120);
        }
        break;

      case Phase.Hold:
        timeout = setTimeout(() => setPhase(Phase.FadeOut), HOLD_DURATION);
        break;

      case Phase.FadeOut:
        timeout = setTimeout(() => {
          setPhase(Phase.InitialPause);
          setQ1Chars(0);
          setQ2Chars(0);
          setA1Chars(0);
          setA2Chars(0);
        }, FADE_OUT_DURATION);
        break;
    }

    return () => clearTimeout(timeout);
  }, [phase, q1Chars, q2Chars, a1Chars, a2Chars]);

  const visible = phase !== Phase.FadeOut;
  const showQ1 = phase >= Phase.SendQ1;
  const showA1 = phase >= Phase.TypingA1;
  const a1Done = a1Chars >= A1.length;
  const showQ2 = phase >= Phase.SendQ2;
  const showA2 = phase >= Phase.TypingA2;
  const showTyping = phase === Phase.BotTyping1 || phase === Phase.BotTyping2;
  const replyCount = (showA1 ? 1 : 0) + (showQ2 ? 1 : 0) + (showA2 ? 1 : 0);

  const composerText =
    phase === Phase.TypingQ1
      ? Q1.slice(0, q1Chars)
      : phase === Phase.TypingQ2
        ? Q2.slice(0, q2Chars)
        : "";
  const composerActive = composerText.length > 0;

  return (
    <div className="w-full select-none font-body px-8 md:px-0">
      <div
        className={`flex h-[520px] w-full overflow-hidden rounded-xl border border-border bg-card shadow-2xl transition-opacity duration-500 md:h-[600px] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Slack sidebar */}
        <div className="hidden w-56 shrink-0 flex-col bg-[#3f0e40] md:flex dark:border-r dark:border-white/[0.06] dark:bg-[#131313]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-[15px] font-bold text-white dark:text-[#d1d2d3]">
              {WORKSPACE_NAME}
            </span>
            <span className="text-white/70 dark:text-[#abadb0]">⌄</span>
          </div>
          <div className="flex flex-col gap-0.5 px-2 py-3">
            <div className="px-2 pb-1 text-[13px] font-medium text-[#cfc3cf] dark:text-[#8c8d8f]">
              Channels
            </div>
            <SidebarChannel name="general" />
            <SidebarChannel name="announcements" />
            <SidebarChannel name="engineering" />
            <SidebarChannel name="design" />
            <SidebarChannel name="product" />
            <SidebarChannel name={CHANNEL} active />
            <SidebarChannel name="marketing" />
            <SidebarChannel name="watercooler" />
            <SidebarChannel name="random" />
          </div>
        </div>

        {/* Main pane */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Thread header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 md:px-5">
            <div className="flex flex-col">
              <span className="text-[15px] font-bold text-[#1d1c1d] dark:text-[#d1d2d3]">
                Thread
              </span>
              <span className="text-xs text-[#616061] dark:text-[#abadb0]">
                # {CHANNEL}
              </span>
            </div>
            <span className="text-lg leading-none text-[#616061] dark:text-[#abadb0]">
              ✕
            </span>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-hidden py-3">
            {showQ1 && (
              <MessageRow
                avatar={<UserAvatar />}
                name={USER_NAME}
                time={USER_TIME}
              >
                {renderRich(Q1)}
              </MessageRow>
            )}

            {replyCount > 0 && (
              <div className="flex items-center gap-3 px-4 py-1.5 md:px-5">
                <span className="text-xs font-bold text-[#616061] dark:text-[#abadb0]">
                  {replyCount === 1 ? "1 reply" : `${replyCount} replies`}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            {showA1 && (
              <MessageRow
                avatar={<BotAvatar />}
                name={BOT_NAME}
                time={BOT_TIME}
                isApp
              >
                {renderRich(A1.slice(0, a1Chars))}
                {phase === Phase.TypingA1 && (
                  <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-[#1d1c1d] dark:bg-[#d1d2d3]" />
                )}
                {a1Done && (
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="flex h-7 items-end gap-[3px]">
                      {SPARKLINE.map((h) => (
                        <span
                          key={h}
                          style={{ height: `${h}%` }}
                          className="w-1.5 rounded-sm bg-[#007a5a]/70"
                        />
                      ))}
                    </span>
                  </div>
                )}
              </MessageRow>
            )}

            {showQ2 && (
              <MessageRow
                avatar={<UserAvatar />}
                name={USER_NAME}
                time={USER_TIME}
              >
                {renderRich(Q2)}
              </MessageRow>
            )}

            {showA2 && (
              <MessageRow
                avatar={<BotAvatar />}
                name={BOT_NAME}
                time={BOT_TIME}
                isApp
              >
                {renderRich(A2.slice(0, a2Chars))}
                {phase === Phase.TypingA2 && (
                  <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-[#1d1c1d] dark:bg-[#d1d2d3]" />
                )}
              </MessageRow>
            )}

            {showTyping && <TypingIndicator />}
          </div>

          {/* Composer */}
          <div className="px-3 pb-3 md:px-4 md:pb-4">
            <div className="rounded-lg border border-[#8d8d8d]/50 dark:border-[#565856]">
              {/* Formatting toolbar */}
              <div className="flex items-center gap-1 px-2 py-1.5 text-[#616061] dark:text-[#abadb0]">
                <span className="rounded px-1.5 py-0.5 text-sm font-bold">
                  B
                </span>
                <span className="rounded px-1.5 py-0.5 text-sm italic">I</span>
                <span className="rounded px-1.5 py-0.5 text-sm line-through">
                  S
                </span>
                <span className="mx-1 h-4 w-px bg-border" />
                <span className="rounded px-1.5 py-0.5 font-code text-xs">
                  {"</>"}
                </span>
                <svg
                  viewBox="0 0 20 20"
                  className="mx-0.5 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M8.5 11.5a3 3 0 0 0 4.24 0l2.5-2.5a3 3 0 1 0-4.24-4.24l-1 1" />
                  <path d="M11.5 8.5a3 3 0 0 0-4.24 0l-2.5 2.5a3 3 0 1 0 4.24 4.24l1-1" />
                </svg>
              </div>

              {/* Input */}
              <div className="px-3 py-2 text-[15px]">
                {composerText ? (
                  <span className="text-[#1d1c1d] dark:text-[#d1d2d3]">
                    {renderRich(composerText)}
                    <span className="ml-px inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-[#1d1c1d] dark:bg-[#d1d2d3]" />
                  </span>
                ) : (
                  <span className="text-[#616061] dark:text-[#abadb0]">
                    Reply…
                  </span>
                )}
              </div>

              {/* Also send to channel */}
              <div className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-[#616061] dark:text-[#abadb0]">
                <span className="h-3.5 w-3.5 rounded-[3px] border border-current" />
                <span>
                  Also send to <span>#</span>{" "}
                  <span className="font-bold text-[#1d1c1d] dark:text-[#d1d2d3]">
                    {CHANNEL}
                  </span>
                </span>
              </div>

              {/* Bottom action bar */}
              <div className="flex items-center justify-between px-2 py-1.5 text-[#616061] dark:text-[#abadb0]">
                <div className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-sm leading-none">
                    +
                  </span>
                  <span className="flex h-5 items-center text-sm font-medium leading-none underline underline-offset-[3px]">
                    Aa
                  </span>
                  <svg
                    viewBox="0 0 20 20"
                    className="h-4.5 w-4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="10" cy="10" r="7" />
                    <path d="M7.2 11.5a3.2 3.2 0 0 0 5.6 0" />
                    <path d="M7.7 8.3h.01" />
                    <path d="M12.3 8.3h.01" />
                  </svg>
                  <span className="flex h-5 -translate-y-px items-center text-base leading-none">
                    @
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${
                    composerActive
                      ? "bg-[#007a5a] text-white"
                      : "text-[#9b9b9b]"
                  }`}
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="h-4 w-4"
                    fill="currentColor"
                  >
                    <path d="M6.5 4.5 L15.5 10 L6.5 15.5 Z" />
                  </svg>
                  <span
                    className={`h-4 w-px ${
                      composerActive ? "bg-white/30" : "bg-border"
                    }`}
                  />
                  <svg
                    viewBox="0 0 20 20"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 8l4 4 4-4" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
