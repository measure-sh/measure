export function isBillingEnabled(): boolean {
    return process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true';
}