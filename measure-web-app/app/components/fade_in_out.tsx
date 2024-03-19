"use client"

import { useState, useRef, useEffect } from 'react'
import { useScrollDirection } from '../utils/scroll_utils';

type FadeInOutProps = {
    children: React.ReactNode
}

export default function FadeInOut({
    children,
}: FadeInOutProps) {
    const [isVisible, setVisible] = useState(false);
    const domRef = useRef<HTMLDivElement | null>(null);
    const scrollDir = useScrollDirection()

    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                setVisible(entry.isIntersecting);
            });
        });

        if (domRef.current) {
            observer.observe(domRef.current);
        }

        return () => {
            if (domRef.current) {
                observer.unobserve(domRef.current);
            }
        };
    }, [scrollDir]);

    function createTransitionAnimation() {
        let visibilityAndScale = isVisible ? 'opacity-100 visible scale-100' : 'opacity-0 invisible scale-75'

        return visibilityAndScale + ' transition duration-700 ease-in-out delay-200 motion-reduce:transition-none'
    }

    return (
        <div
            className={createTransitionAnimation()}
            ref={domRef}
        >
            {children}
        </div>
    )
}