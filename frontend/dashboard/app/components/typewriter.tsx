"use client"

import { useEffect, useState } from 'react'

type Phrase = {
    normal: string
    highlighted: string
}

type TypewriterProps = {
    // phrases are provided as two parts: normal and highlighted
    phrases: Phrase[]
    typingSpeed?: number // ms per character
    deletingSpeed?: number // ms per character
    pause?: number // ms to wait after a phrase is typed
    className?: string
}

export default function Typewriter({
    phrases,
    typingSpeed = 80,
    deletingSpeed = 40,
    pause = 1200,
    className = '',
}: TypewriterProps) {
    const [index, setIndex] = useState(0)
    const [display, setDisplay] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)
    const [blink, setBlink] = useState(true)

    // blinking caret
    useEffect(() => {
        const id = setInterval(() => setBlink(b => !b), 500)
        return () => clearInterval(id)
    }, [])

    useEffect(() => {
        const currentObj: Phrase = phrases[index] || { normal: '', highlighted: '' }
        // Insert a single space between normal and highlighted when both are non-empty
        const spacer = currentObj.normal && currentObj.highlighted && !currentObj.normal.endsWith(' ') && !currentObj.highlighted.startsWith(' ') ? ' ' : ''
        const current = `${currentObj.normal}${spacer}${currentObj.highlighted}`
        let timeoutId: ReturnType<typeof setTimeout>

        if (isDeleting) {
            if (display.length > 0) {
                timeoutId = setTimeout(() => setDisplay(d => d.slice(0, -1)), deletingSpeed)
            } else {
                // move to next phrase
                setIsDeleting(false)
                setIndex(i => (i + 1) % phrases.length)
            }
        } else {
            if (display.length < current.length) {
                timeoutId = setTimeout(() => setDisplay(d => d + current.charAt(d.length)), typingSpeed)
            } else {
                // finished typing this phrase, wait then delete
                timeoutId = setTimeout(() => setIsDeleting(true), pause)
            }
        }

        return () => clearTimeout(timeoutId)
    }, [display, isDeleting, index, phrases, typingSpeed, deletingSpeed, pause])


    // Keep font family but do not force a text size on non-highlighted text.
    // Everything uses uniform size text-4xl; the highlighted portion is provided
    // by the API and wrapped explicitly.
    const displayClasses = `text-foreground text-2xl md:text-4xl font-display`

    // current phrase object for rendering (used to determine which part to underline)
    // We compute a rendered version that includes the optional spacer used during typing
    const basePhraseObj: Phrase = phrases[index] || { normal: '', highlighted: '' }
    const spacer = basePhraseObj.normal && basePhraseObj.highlighted && !basePhraseObj.normal.endsWith(' ') && !basePhraseObj.highlighted.startsWith(' ') ? ' ' : ''
    const currentPhraseObj: Phrase = { normal: `${basePhraseObj.normal}${spacer}`, highlighted: basePhraseObj.highlighted }

    const renderByParts = (displayText: string, phraseObj: Phrase) => {
        if (!displayText) return null

        const normalLen = phraseObj.normal.length
        const highlightedLen = phraseObj.highlighted.length

        const prefix = displayText.slice(0, Math.min(displayText.length, normalLen))
        const inUnder = displayText.length > normalLen ? displayText.slice(normalLen, Math.min(displayText.length, normalLen + highlightedLen)) : ''
        const rest = displayText.length > normalLen + highlightedLen ? displayText.slice(normalLen + highlightedLen) : ''

        return (
            <>
                <span>{prefix}</span>
                {inUnder ? (
                    <span className="underline decoration-yellow-300 decoration-2 underline-offset-4">
                        {inUnder}
                    </span>
                ) : null}
                {rest ? <span>{rest}</span> : null}
            </>
        )
    }

    return (
        <span className={`inline-block p-2 align-baseline ${className}`} aria-live="polite">
            <span className={displayClasses}>{renderByParts(display, currentPhraseObj)}</span>
            <span className="ml-1 inline-block" style={{ opacity: blink ? 1 : 0, verticalAlign: 'baseline' }}>|</span>
        </span>
    )
}
