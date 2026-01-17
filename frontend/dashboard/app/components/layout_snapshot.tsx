'use client'

import { useEffect, useState } from 'react'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from './tooltip'

export type LayoutElementType =
    | "container"
    | "text"
    | "input"
    | "button"
    | "image"
    | "video"
    | "list"
    | "icon"
    | "checkbox"
    | "radio"
    | "dropdown"
    | "slider"
    | "progress"

// have to hardcode colours here. Should map to primary in globals.css
export const LayoutSnapshotStripedBgImage = `repeating-linear-gradient(45deg, oklch(0.8790 0.1690 91.6050) 0, oklch(0.8790 0.1690 91.6050) 1px, transparent 5px, transparent 10px)`

type LayoutElement = {
    label: string
    type: LayoutElementType
    x: number
    y: number
    width: number
    height: number
    scrollable: boolean
    highlighted: boolean
    children: LayoutElement[]
}

type LayoutSnapshotProps = {
    layoutUrl: string
    width: number
    height: number
}

function LayoutElementNode({
    element,
    scaleX,
    scaleY
}: {
    element: LayoutElement
    scaleX: number
    scaleY: number
}) {
    const bgStyle = element.highlighted
        ? {
            backgroundImage: LayoutSnapshotStripedBgImage
        }
        : {}
    const borderClass = element.highlighted
        ? 'border-primary hover:border-primary'
        : 'border-background/60 dark:border-foreground/50 hover:border-primary dark:hover:border-primary'

    const positionStyle = {
        left: element.x * scaleX,
        top: element.y * scaleY,
        width: element.width * scaleX,
        height: element.height * scaleY,
    }

    return (
        <div
            className="absolute"
            style={positionStyle}
        >
            {/* Hover zone - behind children */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className={`absolute inset-0 border box-border ${borderClass}`}
                        style={bgStyle}
                    />
                </TooltipTrigger>
                <TooltipContent
                    side="bottom"
                    align="start"
                    className="font-display max-w-96 text-sm text-white fill-black bg-black pointer-events-none"
                >
                    {element.label}
                </TooltipContent>
            </Tooltip>

            {/* Children - on top, will intercept pointer events */}
            {element.children?.map((child, index) => (
                <LayoutElementNode
                    key={`${child.label}-${index}`}
                    element={child}
                    scaleX={scaleX}
                    scaleY={scaleY}
                />
            ))}
        </div>
    )
}

export default function LayoutSnapshot({ layoutUrl, width, height }: LayoutSnapshotProps) {
    const verticalOrienationWidth = 211
    const verticalOrienationHeight = 366
    const horizontalOrienationWidth = 366
    const horizontalOrienationHeight = 211

    const [layout, setLayout] = useState<LayoutElement | null>(null)

    const fetchLayout = async () => {
        try {
            const response = await fetch(layoutUrl)
            if (!response.ok) {
                throw new Error(`Failed to fetch layout: ${response.statusText}`)
            }
            const data = await response.json()
            setLayout(data)
        } catch (error) {
            console.error('Error fetching layout:', error)
        }
    }

    useEffect(() => {
        fetchLayout()
    }, [layoutUrl])

    if (!layout) {
        return null
    }

    // Determine base dimensions based on orientation
    let baseWidth = verticalOrienationWidth
    let baseHeight = verticalOrienationHeight

    if (layout.width > layout.height) {
        baseWidth = horizontalOrienationWidth
        baseHeight = horizontalOrienationHeight
    }

    // First scaling layer: scale base dimensions to fit within passed width/height
    const containerScale = Math.min(width / baseWidth, height / baseHeight) // maintain aspect ratio

    const scaledWidth = baseWidth * containerScale
    const scaledHeight = baseHeight * containerScale

    // Second scaling layer: scale layout coordinates to scaled dimensions
    const scaleX = (scaledWidth / layout.width)
    const scaleY = (scaledHeight / layout.height)

    return (
        <div
            className="relative overflow-hidden"
            style={{ width: scaledWidth, height: scaledHeight }}
        >
            <LayoutElementNode
                element={layout}
                scaleX={scaleX}
                scaleY={scaleY}
            />
        </div>
    )
}