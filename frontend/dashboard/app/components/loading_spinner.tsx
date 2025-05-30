"use client"

const LoadingSpinner: React.FC = () => {
    return (
        <div
            className="inline-block w-6 h-6 animate-spin rounded-full border-2 border-solid border-black border-e-transparent align-[-0.125em] text-surface motion-reduce:animate-[spin_1.5s_linear_infinite]"
            role="status">
            <span
                className="absolute! -m-px! h-px! w-px! overflow-hidden! whitespace-nowrap! border-0! p-0! [clip:rect(0,0,0,0)]!"
            >Loading...</span>
        </div>
    )
}

export default LoadingSpinner