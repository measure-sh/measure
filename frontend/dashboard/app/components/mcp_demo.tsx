"use client"

import { useEffect, useRef, useState } from 'react'

const USER_PROMPT = 'Can you help me fix crash d58064f1-80d9-4a6a-9f0f-1af51ccfcb19?'

const TOOL_CALL_NAME = 'get_error_details'
const TOOL_CALL_SERVER = 'measure (MCP)'
const TOOL_CALL_ARGS = `{
  "app_id": "a1b2c3d4-5678-9abc-def0-1234567890ab",
  "type": "crash",
  "error_group_id": "d58064f1-80d9-4a6a-9f0f-1af51ccfcb19"
}`

const TOOL_RESULT = `{
  "exception": {
    "title": "java.lang.IllegalStateException@CheckoutActivity.kt",
    "message": "Payment method must be specified",
    "stacktrace": "java.lang.IllegalStateException: Payment method must be specified\\n  at MaterialButton.onClick(CheckoutActivity.kt:102)\\n  at android.view.View.performClick(View.java:6294)\\n  at android.os.Handler.handleCallback(Handler.java:790)\\n  ..."
  },
  "attribute": {
    "device_model": "Pixel 7 Pro",
    "device_manufacturer": "Google",
    "app_version": "1.0.0",
    "thread_name": "main",
    "network_type": "wifi"
  }
}`

const CLAUDE_RESPONSE = `The crash occurs in **CheckoutActivity.kt at line 102** when the user taps the checkout button without selecting a payment method.

The \`IllegalStateException\` is thrown because payment method validation happens inside the click handler instead of preventing the action upfront.

**Fix:** Disable the checkout button until a payment method is selected:

\`\`\`kotlin
checkoutButton.isEnabled = selectedPaymentMethod != null
\`\`\`

This prevents users from reaching the invalid state entirely, eliminating the crash.`

// Animation phase timings
const INITIAL_PAUSE = 1000
const TYPING_SPEED = 35       // ms per character for user prompt
const POST_PROMPT_PAUSE = 800
const THINKING_DURATION = 1500
const TOOL_CALL_FADE = 400
const TOOL_RESULT_FADE = 600
const RESPONSE_SPEED = 15     // ms per character for Claude response
const HOLD_DURATION = 5000
const FADE_OUT_DURATION = 500

enum Phase {
  InitialPause,
  TypingPrompt,
  PostPromptPause,
  Thinking,
  ToolCallAppear,
  ToolResultAppear,
  TypingResponse,
  Hold,
  FadeOut,
}

export default function MCPDemo() {
  const [phase, setPhase] = useState<Phase>(Phase.InitialPause)
  const [promptChars, setPromptChars] = useState(0)
  const [responseChars, setResponseChars] = useState(0)
  const [visible, setVisible] = useState(true)
  const [thinkingDots, setThinkingDots] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [phase, promptChars, responseChars, thinkingDots])

  // Phase transitions
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    let interval: ReturnType<typeof setInterval>

    switch (phase) {
      case Phase.InitialPause:
        timeout = setTimeout(() => setPhase(Phase.TypingPrompt), INITIAL_PAUSE)
        break

      case Phase.TypingPrompt:
        if (promptChars < USER_PROMPT.length) {
          timeout = setTimeout(() => setPromptChars(c => c + 1), TYPING_SPEED)
        } else {
          timeout = setTimeout(() => setPhase(Phase.PostPromptPause), 100)
        }
        break

      case Phase.PostPromptPause:
        timeout = setTimeout(() => setPhase(Phase.Thinking), POST_PROMPT_PAUSE)
        break

      case Phase.Thinking:
        interval = setInterval(() => setThinkingDots(d => (d % 3) + 1), 400)
        timeout = setTimeout(() => {
          clearInterval(interval)
          setPhase(Phase.ToolCallAppear)
        }, THINKING_DURATION)
        break

      case Phase.ToolCallAppear:
        timeout = setTimeout(() => setPhase(Phase.ToolResultAppear), TOOL_CALL_FADE)
        break

      case Phase.ToolResultAppear:
        timeout = setTimeout(() => setPhase(Phase.TypingResponse), TOOL_RESULT_FADE)
        break

      case Phase.TypingResponse:
        if (responseChars < CLAUDE_RESPONSE.length) {
          timeout = setTimeout(() => setResponseChars(c => c + 1), RESPONSE_SPEED)
        } else {
          timeout = setTimeout(() => setPhase(Phase.Hold), 100)
        }
        break

      case Phase.Hold:
        timeout = setTimeout(() => setPhase(Phase.FadeOut), HOLD_DURATION)
        break

      case Phase.FadeOut:
        setVisible(false)
        timeout = setTimeout(() => {
          setPhase(Phase.InitialPause)
          setPromptChars(0)
          setResponseChars(0)
          setThinkingDots(1)
          setVisible(true)
        }, FADE_OUT_DURATION)
        break
    }

    return () => {
      clearTimeout(timeout)
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [phase, promptChars, responseChars])

  const renderResponse = (text: string) => {
    // Simple markdown-like rendering for bold and inline code
    const parts: React.ReactNode[] = []
    let remaining = text
    let key = 0

    while (remaining.length > 0) {
      // Check for code block
      const codeBlockMatch = remaining.match(/^```(\w*)\n([\s\S]*?)```/)
      if (codeBlockMatch) {
        parts.push(
          <div key={key++} className="my-2 rounded bg-[#eef1f5] dark:bg-[#161b22] px-3 py-2">
            <code className="text-[#1f2328] dark:text-[#e6edf3]">{codeBlockMatch[2]}</code>
          </div>
        )
        remaining = remaining.slice(codeBlockMatch[0].length)
        continue
      }

      // Check for bold
      const boldMatch = remaining.match(/^\*\*(.*?)\*\*/)
      if (boldMatch) {
        parts.push(<span key={key++} className="font-bold text-[#1f2328] dark:text-[#f0f6fc]">{boldMatch[1]}</span>)
        remaining = remaining.slice(boldMatch[0].length)
        continue
      }

      // Check for inline code
      const inlineCodeMatch = remaining.match(/^`(.*?)`/)
      if (inlineCodeMatch) {
        parts.push(
          <code key={key++} className="rounded bg-[#eef1f5] dark:bg-[#161b22] px-1 py-0.5 text-[#cf222e] dark:text-[#f97583]">
            {inlineCodeMatch[1]}
          </code>
        )
        remaining = remaining.slice(inlineCodeMatch[0].length)
        continue
      }

      // Regular text - consume until next special character or end
      const nextSpecial = remaining.search(/[`*]/)
      if (nextSpecial === -1) {
        parts.push(<span key={key++}>{remaining}</span>)
        remaining = ''
      } else if (nextSpecial === 0) {
        // Single special char that didn't match a pattern, consume it
        parts.push(<span key={key++}>{remaining[0]}</span>)
        remaining = remaining.slice(1)
      } else {
        parts.push(<span key={key++}>{remaining.slice(0, nextSpecial)}</span>)
        remaining = remaining.slice(nextSpecial)
      }
    }

    return parts
  }

  const showPrompt = phase >= Phase.TypingPrompt
  const showThinking = phase === Phase.Thinking
  const showToolCall = phase >= Phase.ToolCallAppear
  const showToolResult = phase >= Phase.ToolResultAppear
  const showResponse = phase >= Phase.TypingResponse
  const isTypingPrompt = phase === Phase.TypingPrompt
  const isTypingResponse = phase === Phase.TypingResponse

  return (
    <div className="w-full font-display px-8 md:px-0">
      {/* Terminal window */}
      <div
        className={`w-full rounded-lg border border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#0d1117] shadow-2xl overflow-hidden transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-[#d0d7de] dark:border-[#30363d] px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <div className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
        </div>

        {/* Terminal content */}
        <div
          ref={containerRef}
          className="h-[400px] md:h-[500px] min-w-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 font-code text-xs md:text-sm leading-relaxed"
        >
          {/* User prompt */}
          {showPrompt && (
            <div className="flex gap-2">
              <span className="select-none text-[#656d76] dark:text-[#8b949e]">&gt;</span>
              <span className="text-[#1f2328] dark:text-[#f0f6fc]">
                {USER_PROMPT.slice(0, promptChars)}
                {isTypingPrompt && (
                  <span className="animate-pulse text-[#1f2328] dark:text-[#f0f6fc]">|</span>
                )}
              </span>
            </div>
          )}

          {/* Thinking indicator */}
          {showThinking && (
            <div className="mt-4 text-[#656d76] dark:text-[#8b949e]">
              {'.'.repeat(thinkingDots)}
            </div>
          )}

          {/* Tool call */}
          {showToolCall && (
            <div className={`mt-4 rounded border-l-2 border-[#d4c846] bg-[#eef1f5] dark:bg-[#161b22] p-3 transition-opacity duration-300 ${phase >= Phase.ToolCallAppear ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[#656d76] dark:text-[#8b949e]">{TOOL_CALL_SERVER}</span>
                <span className="font-bold text-[#1a7f37] dark:text-[#7ee787]">{TOOL_CALL_NAME}</span>
              </div>
              <pre className="text-[#656d76] dark:text-[#8b949e] whitespace-pre-wrap text-xs">{TOOL_CALL_ARGS}</pre>
            </div>
          )}

          {/* Tool result */}
          {showToolResult && (
            <div className={`mt-3 rounded border-l-2 border-[#58a6ff] bg-[#eef1f5] dark:bg-[#161b22] p-3 transition-opacity duration-300 ${phase >= Phase.ToolResultAppear ? 'opacity-100' : 'opacity-0'}`}>
              <div className="mb-2 text-xs text-[#656d76] dark:text-[#8b949e]">Result</div>
              <pre className="text-[#656d76] dark:text-[#8b949e] whitespace-pre-wrap text-xs">{TOOL_RESULT}</pre>
            </div>
          )}

          {/* Claude response */}
          {showResponse && (
            <div className="mt-4 text-[#1f2328] dark:text-[#e6edf3] whitespace-pre-wrap">
              {renderResponse(CLAUDE_RESPONSE.slice(0, responseChars))}
              {isTypingResponse && (
                <span className="animate-pulse text-[#1f2328] dark:text-[#e6edf3]">|</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
