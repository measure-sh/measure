'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import { CopyIcon, GlobeIcon, LucideTrash2, LucideX, PaperclipIcon, RefreshCcwIcon, StopCircleIcon } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useEffect, useRef, useState } from 'react'
import z from 'zod/v4'
import { AIPageContext } from '../context/ai_chat_context'
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

const AI_CHAT_AUTH_FAILURE_MSG = "Authentication and refresh failed"

const models = [
    {
        name: 'Gemini 2.5 Flash Lite',
        value: 'google/gemini-2.5-flash-lite',
    },
    {
        name: 'Gemini 2.5 Pro',
        value: 'google/gemini-2.5-pro',
    }
]

export const messageMetadataSchema = z.object({
    createdAt: z.number().optional(),
    model: z.string().optional(),
    totalTokens: z.number().optional(),
})

export type MessageMetadata = z.infer<typeof messageMetadataSchema>

export type MeasureUIMessage = UIMessage<MessageMetadata>

interface AIChatProps {
    teamId: string
    context: AIPageContext
    onClose?: () => void
    webSearchEnabled?: boolean
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
    webSearchEnabled = false,
    attachmentsEnabled = false,
    modelSelectEnabled = false,
}: AIChatProps) {
    const router = useRouter()
    const [input, setInput] = useState('')
    const [model, setModel] = useState<string>(models[0].value)
    const [webSearch, setWebSearch] = useState(false)
    const clearAttachmentsRef = useRef<(() => void) | null>(null)
    const addAttachmentRef = useRef<((files: File[]) => void) | null>(null)

    const { messages, setMessages, sendMessage, status, error, stop, regenerate } = useChat<MeasureUIMessage>({
        transport: new DefaultChatTransport({ api: '/ai/chat' }),

        // Clear attachments in the input section on finish or error
        onFinish: () => {
            clearAttachmentsRef.current?.()
        },
        onError: (error) => {
            clearAttachmentsRef.current?.()
            // Go to login if it's an auth error
            if (error.message.includes(AI_CHAT_AUTH_FAILURE_MSG)) {
                router.push('/auth/login')
                return
            }
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
            model: model,
            web_search: webSearch,
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
                    model: model,
                    webSearch: webSearch,
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
                                                                        webSearch: webSearch,
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
                    {status === 'submitted' && <Loader />}
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
                        placeholder="Ask about Measure or get help debugging a Crash or ANR..."
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
                        {context.enable && <PromptInputButton
                            variant={'ghost'}
                            onClick={() => attachPageContext(context)}
                        >
                            <PaperclipIcon size={16} />
                            <span className='font-display'>{context.action !== "" ? context.action : "Attach Page Context"}</span>
                        </PromptInputButton>}
                        {webSearchEnabled &&
                            <PromptInputButton
                                variant={webSearch ? 'default' : 'ghost'}
                                onClick={() => setWebSearch(!webSearch)}
                            >
                                <GlobeIcon size={16} />
                                <span>Search</span>
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
        </div>
    )
}