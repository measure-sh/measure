import React, { useEffect, useRef } from 'react';

const PhoneECG: React.FC = () => {
    const pathRef = useRef<SVGPathElement | null>(null);

    useEffect(() => {
        const path = pathRef.current;
        if (!path) return;

        const length = path.getTotalLength();
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length * 2}`;

        const animate = () => {
            const currentOffset = parseFloat(path.style.strokeDashoffset);
            if (currentOffset <= 0) {
                path.style.strokeDashoffset = `${length * 2}`;
            } else {
                path.style.strokeDashoffset = `${currentOffset - (length / 120)}`;
            }
            requestAnimationFrame(animate);
        };

        const animationId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, []);

    return (
        <div className="w-52 h-96 rounded-3xl border-2 border-neutral-950 p-4 relative">
            <div className="w-full h-full border-2 border-neutral-950 bg-neutral-950 rounded-2xl">
                {/* Notch */}
                <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-12 h-3 bg-white rounded-full" />

                {/* ECG Animation */}
                <div className='flex w-full h-full items-center justify-center'>
                    <svg viewBox="0 0 54 64" version="1.1" xmlns="http://www.w3.org/2000/svg" className='w-1/2'>
                        <g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                            <path
                                ref={pathRef}
                                d="M0.5,38.5 L16,38.5 L19,25.5 L24.5,57.5 L31.5,7.5 L37.5,46.5 L43,38.5 L53.5,38.5"
                                stroke="#FEF08A"
                                strokeWidth="1"
                            />
                        </g>
                    </svg>
                </div>
            </div>

            {/* Home button */}
            <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-neutral-950 rounded-full" />
        </div >
    );
};

export default PhoneECG;