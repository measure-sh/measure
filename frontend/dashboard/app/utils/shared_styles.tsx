export const underlineLinkStyle = "underline decoration-2 underline-offset-2 decoration-amber-300 hover:decoration-amber-400"

const HIGHLIGHT_BASE =
    "relative inline-block isolate whitespace-nowrap before:content-[''] before:absolute before:inset-y-[0.05em] before:-inset-x-1 before:-skew-x-12 before:-z-10 before:rounded-sm"

const HIGHLIGHT_COLORS = {
    yellow: "before:bg-yellow-400",
    red: "before:bg-red-500",
    pink: "before:bg-pink-400",
    rose: "before:bg-rose-400",
    sky: "before:bg-sky-400",
    green: "before:bg-green-400",
} as const

export function highlightStyle(
    color: keyof typeof HIGHLIGHT_COLORS = "yellow",
): string {
    return `${HIGHLIGHT_BASE} ${HIGHLIGHT_COLORS[color]}`
}

export const chartTheme = {
    text: {
        fill: 'var(--foreground)',
    },
    axis: {
        ticks: {
            text: {
                fill: 'var(--foreground)',
            },
        },
    },
    legends: {
        text: {
            fill: 'var(--foreground)',
        },
    },
    crosshair: {
        line: {
            stroke: 'var(--foreground)',
            strokeWidth: 1,
        },
    },
};