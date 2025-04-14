import { useEffect, useState } from "react"

export function useScrollDirection() {
    const [scrollDir, setScrollDir] = useState('scrolling up')

    useEffect(() => {
        const threshold = 0
        let lastScrollY = window.scrollY
        let animating = false

        const updateScrollDir = () => {
            const scrollY = window.scrollY

            if (Math.abs(scrollY - lastScrollY) < threshold) {
                animating = false
                return
            }
            setScrollDir(scrollY > lastScrollY ? 'scrolling down' : 'scrolling up')
            lastScrollY = scrollY > 0 ? scrollY : 0
            animating = false
        }

        const onScroll = () => {
            if (!animating) {
                window.requestAnimationFrame(updateScrollDir)
                animating = true
            }
        }

        window.addEventListener('scroll', onScroll)

        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    return scrollDir
}

export function useScrollStop(
    elementRef: React.RefObject<HTMLElement>,
    onScrollStop: () => void,
    delay = 150
) {
    useEffect(() => {
        const element = elementRef.current
        if (!element) return

        let timeoutId: number | null = null
        let animating = false

        const updateScrollState = () => {
            if (timeoutId) {
                window.clearTimeout(timeoutId)
            }

            timeoutId = window.setTimeout(() => {
                onScrollStop()
                animating = false
            }, delay)

            animating = false
        }

        const onScroll = () => {
            if (!animating) {
                window.requestAnimationFrame(updateScrollState)
                animating = true
            }
        }

        element.addEventListener('scroll', onScroll)

        return () => {
            element.removeEventListener('scroll', onScroll)
            if (timeoutId) {
                window.clearTimeout(timeoutId)
            }
        }
    }, [elementRef, onScrollStop, delay])
}