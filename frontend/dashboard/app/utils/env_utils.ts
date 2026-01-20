export function isCloud(): boolean {
    return process.env.NEXT_PUBLIC_IS_CLOUD === 'true';
}