'use client'

import { useEffect, useState } from 'react'

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
    id: string
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
    scaleY,
    onHover,
    hoveredId
}: {
    element: LayoutElement
    scaleX: number
    scaleY: number
    onHover: (id: string | null) => void
    hoveredId: string | null
}) {
    const isHovered = element.id === hoveredId

    const baseClasses = 'absolute border box-border cursor-pointer'
    const bgStyle = element.highlighted
        ? {
            backgroundImage: LayoutSnapshotStripedBgImage
        }
        : {}
    const borderClass = element.highlighted
        ? 'border-primary'
        : isHovered
            ? 'border-primary'
            : 'border-background/60 dark:border-foreground/50 '

    return (
        <div
            className={`${baseClasses} ${borderClass}`}
            style={{
                left: element.x * scaleX,
                top: element.y * scaleY,
                width: element.width * scaleX,
                height: element.height * scaleY,
                ...bgStyle
            }}
            onMouseEnter={() => onHover(element.id)}
            onMouseLeave={() => onHover(null)}
        >
            {element.children?.map(child => (
                <LayoutElementNode
                    key={child.id}
                    element={child}
                    scaleX={scaleX}
                    scaleY={scaleY}
                    onHover={onHover}
                    hoveredId={hoveredId}
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
    const [hoveredId, setHoveredId] = useState<string | null>(null)
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)

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
    const containerScaleX = width / baseWidth
    const containerScaleY = height / baseHeight
    const containerScale = Math.min(containerScaleX, containerScaleY) // maintain aspect ratio

    const scaledWidth = baseWidth * containerScale
    const scaledHeight = baseHeight * containerScale

    // Second scaling layer: scale layout coordinates to scaled dimensions
    const scaleX = (scaledWidth / layout.width)
    const scaleY = (scaledHeight / layout.height)

    const findHoveredLabel = (element: LayoutElement, id: string | null): string | null => {
        if (!id) return null
        if (element.id === id) return element.label
        for (const child of element.children || []) {
            const result = findHoveredLabel(child, id)
            if (result) return result
        }
        return null
    }

    const hoveredLabel = findHoveredLabel(layout, hoveredId)

    const handleMouseMove = (event: React.MouseEvent) => {
        setMousePosition({ x: event.clientX, y: event.clientY })
    }

    return (
        <div
            className="relative overflow-hidden"
            style={{ width: scaledWidth, height: scaledHeight }}
            onMouseMove={handleMouseMove}
        >
            <LayoutElementNode
                element={layout}
                scaleX={scaleX}
                scaleY={scaleY}
                onHover={setHoveredId}
                hoveredId={hoveredId}
            />

            {hoveredLabel && mousePosition && (
                <div
                    className="fixed bg-black bg-opacity-50 font-display text-white px-2 py-1 rounded z-50 pointer-events-none"
                    style={{
                        top: mousePosition.y + 20, // Offset further below the cursor
                        left: mousePosition.x + 10, // Offset slightly to the right of the cursor
                    }}
                >
                    {hoveredLabel}
                </div>
            )}
        </div>
    )
}

