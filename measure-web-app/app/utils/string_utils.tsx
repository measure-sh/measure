export function formatToCamelCase(string: string): string {
    return string.charAt(0).toLocaleUpperCase() + string.slice(1)
}