import React, { useRef } from 'react';

interface SessionTimelineSeekBarProps {
  value: number;
  onChange: (value: number) => void;
}

interface CSSProperties extends React.CSSProperties {
  '--thumb-width'?: string;
  '--thumb-height'?: string;
  '--thumb-color'?: string;
  '--track-color'?: string;
  '--progress-color'?: string;
  '--progress-percent'?: string;
}

const SessionTimelineSeekBar: React.FC<SessionTimelineSeekBarProps> = ({ value, onChange }) => {
  const rangeRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = parseInt(e.target.value, 10);
    console.log(value)
    onChange(newValue);
  };

  return (
    <div className="relative w-full">
      <input
        ref={rangeRef}
        type="range"
        min="1"
        max="100"
        value={value}
        onChange={handleInputChange}
        className="relative w-full h-1 bg-gray-200 rounded appearance-none focus:outline-none cursor-pointer"
        style={{
          '--thumb-width': '2px',
          '--thumb-height': '400px',
          '--thumb-margin': '20px',
          '--thumb-color': '#262626',
          '--track-color': '#ffffff',
          '--track-border-color': '#262626',
          '--progress-color': '#262626',
          '--progress-percent': `${value}%`,
        } as CSSProperties}
      />

      <style jsx>{`
        /* Webkit (Chrome, Safari, Edge) */
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          cursor: pointer;
          width: var(--thumb-width);
          height: var(--thumb-height);
          background-color: transparent;
          border: calc(var(--thumb-width)/2) dashed var(--thumb-color); 
          border-radius: 0;
          transform-origin: bottom center;
          margin-top: calc(-1 * var(--thumb-height) - var(--thumb-margin)); /* Only extends upward */
        }

        /* Firefox */
        input[type='range']::-moz-range-thumb {
          width: var(--thumb-width);
          height: var(--thumb-height);
          background-color: transparent;
          border: calc(var(--thumb-width)/2) dashed var(--thumb-color); 
          border-radius: 0;
          border: none;
          transform-origin: bottom center;
          margin-top: calc(-1 * var(--thumb-height) - var(--thumb-margin)); /* Only extends upward */
        }

        /* Track styling */
        input[type='range']::-webkit-slider-runnable-track {
          width: 100%;
          height: 8px;
          background: linear-gradient(to right, 
            var(--progress-color) 0%, 
            var(--progress-color) var(--progress-percent),
            var(--track-color) var(--progress-percent),
            var(--track-color) 100%);
          border: 1px solid var(--track-border-color);
          border-radius: 8px;
          cursor: pointer;
        }

        input[type='range']::-moz-range-track {
          width: 100%;
          height: 8px;
          background: linear-gradient(to right, 
            var(--progress-color) 0%, 
            var(--progress-color) var(--progress-percent),
            var(--track-color) var(--progress-percent),
            var(--track-color) 100%);
          border: 1px solid var(--track-border-color);
          border-radius: 8px;
          cursor: pointer;
        }

        /* Ensure the thumb is always visible */
        input[type='range'] {
          z-index: 1;
        }
      `}</style>
    </div>
  );
};

export default SessionTimelineSeekBar;