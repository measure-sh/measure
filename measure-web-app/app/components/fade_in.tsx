"use client"

import { useState, useRef, useEffect } from 'react'
import { useScrollDirection } from '../utils/scroll_utils';

type FadeInProps = {
    children: React.ReactNode
}

export default function FadeIn({
    children,
}: FadeInProps) {
    const [isVisible, setVisible] = useState(false);
    const domRef = useRef<HTMLDivElement | null>(null);
    const scrollDir = useScrollDirection()

    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting !== isVisible) {
                    setVisible(entry.isIntersecting);
                }
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
    }, []);

    return (
        <div
            className={`transition duration-700 ease-in-out motion-reduce:transition-none ${isVisible ? 'opacity-100 visible translate-y-0' : scrollDir === 'scrolling down' ? 'opacity-0 invisible translate-y-28' : 'opacity-0 invisible -translate-y-28'}`}
            ref={domRef}
        >
            {children}
        </div>
    )
}