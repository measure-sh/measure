// components/CustomPlayButton.tsx
import React from 'react'

interface VideoPlayButtonProps {
    onClick: () => void
}

const VideoPlayButton: React.FC<VideoPlayButtonProps> = ({ onClick }) => (
    <button
        onClick={onClick}
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-75 rounded-full p-4 hover:bg-opacity-100 transition-all duration-200"
    >
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="8 5 18 12 8 19 8 5"></polygon>
        </svg>
    </button>
)

export default VideoPlayButton