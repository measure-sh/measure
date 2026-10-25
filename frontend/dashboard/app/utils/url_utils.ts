import { useEffect } from "react";

export function enumFromUrl<T extends string>(
  values: T[],
  value: string | null,
  fallback: T,
): T {
  return values.find((v) => v === value) ?? fallback;
}

export function offsetFromUrl(value: string | null): number {
  const offset = Number(value);
  return Number.isSafeInteger(offset) && offset > 0 ? offset : 0;
}

// The first page is left out of URLs.
export function offsetUrlValue(offset: number): string | null {
  return offset === 0 ? null : String(offset);
}

export function unknownOffset(value: string | null): boolean {
  return value !== null && offsetFromUrl(value) === 0;
}

export function unknownUrlKeys(
  params: { get: (key: string) => string | null },
  values: Record<string, string[]>,
): string[] {
  return Object.entries(values)
    .filter(([key, allowed]) => {
      const value = params.get(key);
      return value !== null && !allowed.includes(value);
    })
    .map(([key]) => key);
}

// A list that comes back empty past its first page lost rows since the page
// was read, such as when a relative date range moved on, so its page is no
// longer one the list has.
export function pastLastPage(
  offset: number,
  query: {
    status: string;
    isPlaceholderData: boolean;
    data?: { results: unknown[] };
  },
): boolean {
  return (
    offset > 0 &&
    query.status === "success" &&
    !query.isPlaceholderData &&
    query.data?.results.length === 0
  );
}

// Calls discard after every render while keys remain, since discard skips a
// removal until the filters are in the URL and the URL settles, and either
// can happen without the keys changing.
export function useDiscardUrlKeys(
  keys: string[],
  discard: (keys: string[]) => void,
) {
  useEffect(() => {
    if (keys.length > 0) {
      discard(keys);
    }
  });
}
