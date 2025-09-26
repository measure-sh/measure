'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { CopyIcon, LucideTrash2, LucideX, PaperclipIcon, RefreshCcwIcon, StopCircleIcon } from 'lucide-react'
import { DateTime } from 'luxon'
import Image from 'next/image'
import posthog from 'posthog-js'
import { useEffect, useRef, useState } from 'react'
import { measureAuth } from '../auth/measure_auth'
import { AIPageContext } from '../context/ai_chat_context'
import { isMeasureHost } from '../utils/url_utils'
import { Action, Actions } from './ai-elements/actions'
import { Conversation, ConversationContent, ConversationScrollButton } from './ai-elements/conversation'
import { Loader } from './ai-elements/loader'
import { Message, MessageContent } from './ai-elements/message'
import {
    PromptInput,
    PromptInputActionAddAttachments,
    PromptInputActionMenu,
    PromptInputActionMenuContent,
    PromptInputActionMenuTrigger,
    PromptInputAttachment,
    PromptInputAttachments,
    PromptInputBody,
    PromptInputButton,
    type PromptInputMessage,
    PromptInputModelSelect,
    PromptInputModelSelectContent,
    PromptInputModelSelectItem,
    PromptInputModelSelectTrigger,
    PromptInputModelSelectValue,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputToolbar,
    PromptInputTools,
    usePromptInputAttachments,
} from './ai-elements/prompt-input'
import { Reasoning, ReasoningContent, ReasoningTrigger } from './ai-elements/reasoning'
import { Response } from './ai-elements/response'
import { Source, Sources, SourcesContent, SourcesTrigger } from './ai-elements/sources'
import { Button } from './button'

const models = [
    {
        name: 'Gemini 2.5 Flash Lite',
        value: 'google/gemini-2.5-flash-lite',
    },
    {
        name: 'Gemini 2.5 Pro',
        value: 'google/gemini-2.5-pro',
    },
    {
        name: 'Claude Haiku 4.5',
        value: 'anthropic/claude-haiku-4.5',
    }
]

interface AIChatProps {
    teamId: string
    context: AIPageContext
    onClose?: () => void
    attachmentsEnabled?: boolean
    modelSelectEnabled?: boolean
}

// Custom component to access the clear function
function PromptInputClearHandler({ onClearReady }: { onClearReady: (clearFn: () => void) => void }) {
    const { clear } = usePromptInputAttachments()

    useEffect(() => {
        onClearReady(clear)
    }, [clear, onClearReady])

    return null
}

// Custom component to access the file add function
function PromptInputAddAttachmentHandler({ onAddReady }: { onAddReady: (addFn: (files: File[]) => void) => void }) {
    const { add } = usePromptInputAttachments()

    useEffect(() => {
        onAddReady(add)
    }, [add, onAddReady])

    return null
}

export default function AIChat({
    teamId,
    context,
    onClose,
    attachmentsEnabled = false,
    modelSelectEnabled = false,
}: AIChatProps) {
    const selfHosted = !isMeasureHost()
    const [input, setInput] = useState('')
    const [model, setModel] = useState<string>(models[2].value)
    const clearAttachmentsRef = useRef<(() => void) | null>(null)
    const addAttachmentRef = useRef<((files: File[]) => void) | null>(null)

    const { messages, setMessages, sendMessage, status, error, stop, regenerate } = useChat({
        transport: new DefaultChatTransport({
            api: '/ai/chat',
            fetch: (input, init) => measureAuth.fetchMeasure(input, init)
        }),

        // Clear attachments in the input section on finish or error
        onFinish: () => {
            clearAttachmentsRef.current?.()
        },
        onError: (error) => {
            clearAttachmentsRef.current?.()
        }
    })

    const clearMessages = () => {
        setMessages([])
    }

    const attachPageContext = (context: AIPageContext) => {
        console.log("Attaching page context:", context)

        const blob = new Blob([context.content], { type: 'text/plain' })
        const file = new File([blob], `${context.fileName}.txt`, { type: 'text/plain' })

        if (addAttachmentRef.current) {
            addAttachmentRef.current([file])
        }
    }

    const handleSubmit = async (message: PromptInputMessage) => {
        posthog.capture('ai_chat_message_submitted', {
            team_id: teamId,
            app_id: context.appId,
            model: model,
            has_attachments: message.files ? message.files.length > 0 : false,
            message: message.text,
        })

        const hasText = Boolean(message.text)
        const hasAttachments = Boolean(message.files?.length)

        if (!(hasText || hasAttachments)) {
            return
        }

        // Convert blob URLs to base64 data URLs
        const filesWithData = message.files ? await Promise.all(
            message.files.map(async (file) => {
                if (file.url?.startsWith('blob:')) {
                    const response = await fetch(file.url)
                    const blob = await response.blob()
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader()
                        reader.onloadend = () => resolve(reader.result as string)
                        reader.readAsDataURL(blob)
                    })
                    return { ...file, url: base64 }
                }
                return file
            })
        ) : undefined

        sendMessage(
            {
                text: message.text!,
                files: filesWithData,
            },
            {
                body: {
                    teamId: teamId,
                    appId: context.appId,
                    timezone: DateTime.now().zone.name,
                    model: model,
                    selfHosted: selfHosted,
                },
            },
        )
        setInput('')
    }

    return (
        <div className={`flex flex-col w-full relative h-full`}>
            <div className='flex flex-row w-full gap-1 justify-between py-1'>
                <Button
                    variant="ghost"
                    className="select-none"
                    onClick={onClose}
                >
                    <LucideX />
                </Button>
                <Button
                    variant="ghost"
                    className="select-none"
                    onClick={clearMessages}
                >
                    <LucideTrash2 />
                </Button>
            </div>
            <Conversation className="h-full">
                {messages.length === 0 && (
                    <div className='flex flex-col items-center justify-center h-full px-4 select-none'>
                        <p className='w-full justify-start text-neutral-400 text-xl px-6 py-4'>Try asking:</p>
                        <div className='text-neutral-400 text-sm'>
                            <ul className='space-y-4 list-disc'>
                                <li className=''>How can I send custom events in Measure?</li>
                                <li className=''>Help me debug my top Crash.</li>
                                <li className=''>How many users go from Home to Settings?</li>
                                <li className=''>Show me the latest session of user with Id: &rdquo;user-id-1&rdquo;</li>
                            </ul>
                        </div>
                    </div>
                )}
                <ConversationContent>
                    {messages.map((message) => (
                        <div key={message.id}>
                            {message.role === 'assistant' && message.parts.filter((part) => part.type === 'source-url').length > 0 && (
                                <Sources>
                                    <SourcesTrigger
                                        count={
                                            message.parts.filter(
                                                (part) => part.type === 'source-url',
                                            ).length
                                        }
                                    />
                                    {message.parts.filter((part) => part.type === 'source-url').map((part, i) => (
                                        <SourcesContent key={`${message.id}-${i}`}>
                                            <Source
                                                key={`${message.id}-${i}`}
                                                href={part.url}
                                                title={part.url}
                                            />
                                        </SourcesContent>
                                    ))}
                                </Sources>
                            )}
                            {message.parts.map((part, i) => {
                                switch (part.type) {
                                    case 'text':
                                        return (
                                            <div className='group' key={`${message.id}-${i}`}>
                                                <Message from={message.role}>
                                                    <MessageContent variant="flat">
                                                        {/* Show attachments for user messages */}
                                                        {message.role === 'user' && message.parts.filter((p) => p.type === 'file').length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mb-3">
                                                                {message.parts.filter((p) => p.type === 'file').map((filePart, fileIdx) => (
                                                                    <div
                                                                        key={`${message.id}-file-${fileIdx}`}
                                                                        className="h-14 w-14 rounded-md border overflow-hidden"
                                                                    >
                                                                        {filePart.mediaType?.startsWith('image/') && filePart.url ? (
                                                                            <Image
                                                                                alt={filePart.filename || 'attachment'}
                                                                                className="size-full rounded-md object-cover"
                                                                                width={56}
                                                                                height={56}
                                                                                src={filePart.url}
                                                                            />
                                                                        ) : (
                                                                            <div className="flex flex-col size-full items-center justify-center text-slate-500 dark:text-slate-400">
                                                                                <PaperclipIcon className="size-4" />
                                                                                <p className="text-[8px] w-full truncate px-2 mt-1">
                                                                                    {filePart.filename}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <Response>
                                                            {part.text}
                                                        </Response>
                                                    </MessageContent>
                                                </Message>
                                                {message.role === 'user' && (
                                                    <Actions className="mt-2 group-hover:visible invisible justify-end">
                                                        <Action
                                                            onClick={() =>
                                                                navigator.clipboard.writeText(part.text)
                                                            }
                                                            label="Copy"
                                                        >
                                                            <CopyIcon className="size-3" />
                                                        </Action>
                                                    </Actions>
                                                )}
                                                {message.role === 'assistant' && (
                                                    <Actions className="mt-2 group-hover:visible invisible">
                                                        {i === messages.length - 1 &&
                                                            <Action
                                                                onClick={() => regenerate({
                                                                    messageId: message.id, body: {
                                                                        model: model,
                                                                    },
                                                                })}
                                                                disabled={!(status === 'ready' || status === 'error')}
                                                                label="Retry"
                                                            >
                                                                <RefreshCcwIcon className="size-3" />
                                                            </Action>}
                                                        <Action
                                                            onClick={() =>
                                                                navigator.clipboard.writeText(part.text)
                                                            }
                                                            label="Copy"
                                                        >
                                                            <CopyIcon className="size-3" />
                                                        </Action>
                                                    </Actions>
                                                )}
                                            </div>
                                        )
                                    case 'reasoning':
                                        return (
                                            <Reasoning
                                                key={`${message.id}-${i}`}
                                                className="w-full"
                                                isStreaming={status === 'streaming' && i === message.parts.length - 1 && message.id === messages.at(-1)?.id}
                                            >
                                                <ReasoningTrigger />
                                                <ReasoningContent>{part.text}</ReasoningContent>
                                            </Reasoning>
                                        )
                                    default:
                                        return null
                                }
                            })}
                        </div>
                    ))}
                    {status === 'submitted' &&
                        <div className='flex flex-row gap-2 items-center'>
                            <p className='text-sm text-gray-400'>{['Thinking', 'Analyzing', 'Contemplating', 'Reasoning', 'Reflecting', 'Deliberating'][Math.floor(Math.random() * 6)]}</p>
                            <Loader />
                        </div>
                    }
                    {error && <Message from="assistant">
                        <MessageContent variant="flat" className='bg-red-600 py-4 px-2'>
                            <Response className='text-white'>
                                {error.message ? error.message : 'Something went wrong. Please try again.'}
                            </Response>
                        </MessageContent>
                    </Message>}
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>

            <PromptInput onSubmit={handleSubmit} className="mt-4" maxFiles={10} maxFileSize={10 * 1024 * 1024} globalDrop multiple>
                <PromptInputClearHandler onClearReady={(clearFn) => { clearAttachmentsRef.current = clearFn }} />
                <PromptInputAddAttachmentHandler onAddReady={(addFn) => { addAttachmentRef.current = addFn }} />
                <PromptInputBody>
                    <PromptInputAttachments>
                        {(attachment) => <PromptInputAttachment data={attachment} />}
                    </PromptInputAttachments>
                    <PromptInputTextarea
                        className='placeholder:text-neutral-400'
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                // Don't submit if IME composition is in progress
                                if (e.nativeEvent.isComposing) {
                                    return
                                }

                                if (e.shiftKey) {
                                    // Allow newline
                                    return
                                }

                                if (status === 'submitted' || status === 'streaming') {
                                    // Don't submit if a message is being sent or streamed
                                    e.preventDefault()
                                    return
                                }

                                // Submit on Enter (without Shift)
                                e.preventDefault();
                                const form = e.currentTarget.form;
                                if (form) {
                                    form.requestSubmit()
                                }
                            }
                        }}
                        placeholder="How can I help you?"
                        value={input}
                    />
                </PromptInputBody>
                <PromptInputToolbar className='select-none'>
                    <PromptInputTools>
                        {attachmentsEnabled && status !== 'submitted' && status !== 'streaming' &&
                            <PromptInputActionMenu>
                                <PromptInputActionMenuTrigger />
                                <PromptInputActionMenuContent>
                                    <PromptInputActionAddAttachments />
                                </PromptInputActionMenuContent>
                            </PromptInputActionMenu>}
                        {context.enable && status !== 'submitted' && status !== 'streaming' &&
                            <PromptInputButton
                                variant={'ghost'}
                                onClick={() => attachPageContext(context)}
                            >
                                <PaperclipIcon size={16} />
                                <span className='font-display'>{context.action !== "" ? context.action : "Attach Page Context"}</span>
                            </PromptInputButton>}
                        {modelSelectEnabled &&
                            <PromptInputModelSelect
                                onValueChange={(value) => {
                                    setModel(value)
                                }}
                                value={model}
                            >
                                <PromptInputModelSelectTrigger>
                                    <PromptInputModelSelectValue />
                                </PromptInputModelSelectTrigger>
                                <PromptInputModelSelectContent>
                                    {models.map((model) => (
                                        <PromptInputModelSelectItem key={model.value} value={model.value}>
                                            {model.name}
                                        </PromptInputModelSelectItem>
                                    ))}
                                </PromptInputModelSelectContent>
                            </PromptInputModelSelect>}
                    </PromptInputTools>
                    {(status === 'submitted' || status === 'streaming') &&
                        <PromptInputButton
                            variant={'ghost'}
                            onClick={stop}
                        >
                            <StopCircleIcon size={16} />
                        </PromptInputButton>}
                    {status !== 'submitted' && status !== 'streaming' && <PromptInputSubmit onAbort={stop} disabled={!input} status={status} variant={'ghost'} className='disabled:opacity-50' />}
                </PromptInputToolbar>
            </PromptInput>
            <p className='text-neutral-400 py-2 px-2 text-[12px] text-center'>AI can make mistakes. Please verify important information.</p>
        </div>
    )
}