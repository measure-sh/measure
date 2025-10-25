'use client'

import { createContext, ReactNode, useContext, useState } from 'react'

export type AIPageContext = {
    appId: string
    enable: boolean
    action: string
    content: string
    fileName: string
}
interface AIChatContextType {
    pageContext: AIPageContext
    setPageContext: (context: AIPageContext) => void
}

const AIChatContext = createContext<AIChatContextType | undefined>(undefined)

export function AIChatProvider({ children }: { children: ReactNode }) {
    const [pageContext, setPageContext] = useState<AIPageContext>({
        appId: "",
        enable: false,
        action: "",
        content: "",
        fileName: "",
    })

    return (
        <AIChatContext.Provider value={{ pageContext, setPageContext }}>
            {children}
        </AIChatContext.Provider>
    )
}

export function useAIChatContext() {
    const context = useContext(AIChatContext)
    if (context === undefined) {
        throw new Error('useAIChatContext must be used within an AIChatProvider')
    }
    return context
}