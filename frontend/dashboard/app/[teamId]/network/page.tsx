"use client"

export default function NetworkOverview({ params }: { params: { teamId: string } }) {
    return (
        <div className="flex flex-col items-start">
            <p className="font-display text-4xl max-w-6xl text-center">Network</p>
            <div className="py-4" />
        </div>
    )
}
