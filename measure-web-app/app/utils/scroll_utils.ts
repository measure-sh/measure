import { useEffect, useState } from "react";

export function useScrollDirection() {
    const [scrollDir, setScrollDir] = useState('scrolling up');

    useEffect(() => {
        const threshold = 0;
        let lastScrollY = window.pageYOffset;
        let animating = false;

        const updateScrollDir = () => {
            const scrollY = window.pageYOffset;

            if (Math.abs(scrollY - lastScrollY) < threshold) {
                animating = false;
                return;
            }
            setScrollDir(scrollY > lastScrollY ? 'scrolling down' : 'scrolling up');
            lastScrollY = scrollY > 0 ? scrollY : 0;
            animating = false;
        };

        const onScroll = () => {
            if (!animating) {
                window.requestAnimationFrame(updateScrollDir);
                animating = true;
            }
        };

        window.addEventListener('scroll', onScroll);

        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return scrollDir;
}