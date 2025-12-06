'use client';
import Link from "next/dist/client/link";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { Button } from "./button";

export function CookieBanner() {
    const [consentGiven, setConsentGiven] = useState('');

    useEffect(() => {
        // We want this to only run once the client loads
        // or else it causes a hydration error
        setConsentGiven(posthog.get_explicit_consent_status());
    }, []);

    const handleAcceptCookies = () => {
        posthog.opt_in_capturing();
        setConsentGiven('granted');
    };

    const handleDeclineCookies = () => {
        posthog.opt_out_capturing();
        setConsentGiven('denied');
    };

    return (
        <>
            {consentGiven == 'pending' && (
                <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-start pointer-events-none">
                    <div className="mx-4 w-full max-w-xl flex flex-col border border-neutral-800 items-start bg-white font-display text-black rounded-md p-4 shadow-lg pointer-events-auto">
                        <p>
                            We use cookies to understand how you use
                            the product and help us improve it. To learn more,
                            please see our <Link target="_blank" className="underline decoration-2 underline-offset-2 decoration-yellow-200 hover:decoration-yellow-500" href="/privacy_policy">privacy policy</Link>.
                        </p>
                        <div className="flex flex-row gap-2 mt-4">
                            <Button variant="default" onClick={handleAcceptCookies}>Accept All</Button>
                            <Button variant="ghost" onClick={handleDeclineCookies}>Accept Essential</Button>
                        </div>
                    </div>
                </div >
            )
            }
        </>
    );
}