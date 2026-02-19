'use client';

import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";
import { underlineLinkStyle } from "../utils/shared_styles";
import { Button } from "./button";

export function CookieBanner() {
    const posthog = usePostHog();
    const [consentGiven, setConsentGiven] = useState('');

    useEffect(() => {
        if (posthog) {
            setConsentGiven(posthog.get_explicit_consent_status());
        }
    }, [posthog]);

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
                <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-start">
                    <div className="mx-4 w-full max-w-xl flex flex-col border border-border items-start bg-accent text-accent-foreground font-display rounded-md p-4 shadow-lg">
                        <p>
                            We use cookies to understand how you use
                            the product and help us improve it. To learn more,
                            please see our <Link target="_blank" className={underlineLinkStyle} href="/privacy_policy">privacy policy</Link>.
                        </p>
                        <div className="flex flex-row gap-2 mt-4">
                            <Button variant="default" onClick={handleAcceptCookies}>Accept All</Button>
                            <Button variant="ghost" className={"text-accent-foreground/50"} onClick={handleDeclineCookies}>Accept Essential</Button>
                        </div>
                    </div>
                </div >
            )}
        </>
    );
}