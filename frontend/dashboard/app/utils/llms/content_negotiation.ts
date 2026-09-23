interface MediaRange {
  type: string;
  subtype: string;
  q: number;
  position: number;
}

export function parseAccept(header: string): MediaRange[] {
  const ranges: MediaRange[] = [];
  header.split(",").forEach((part, position) => {
    const [media, ...params] = part.split(";").map((s) => s.trim());
    const [type, subtype, ...rest] = media.toLowerCase().split("/");
    if (!type || !subtype || rest.length > 0) {
      return;
    }

    let q = 1;
    for (const param of params) {
      const [key, value] = param.split("=").map((s) => s.trim());
      if (key.toLowerCase() === "q") {
        const parsed = Number(value);
        // RFC 9110 limits q to [0, 1]. A malformed weight keeps the
        // default of 1 so a typo does not turn into a refusal.
        if (value && Number.isFinite(parsed)) {
          q = Math.min(Math.max(parsed, 0), 1);
        }
      }
    }
    ranges.push({ type, subtype, q, position });
  });
  return ranges;
}

function specificity(range: MediaRange): number {
  if (range.type === "*") return 0;
  if (range.subtype === "*") return 1;
  return 2;
}

// The weight a client gives one media type is taken from the most
// specific range that matches it, so "text/markdown;q=0, */*" refuses
// markdown even though the wildcard accepts everything else.
function bestMatch(ranges: MediaRange[], mediaType: string): MediaRange | null {
  const [type, subtype] = mediaType.split("/");
  let best: MediaRange | null = null;
  for (const range of ranges) {
    const matches =
      (range.type === type || range.type === "*") &&
      (range.subtype === subtype || range.subtype === "*");
    if (matches && (!best || specificity(range) > specificity(best))) {
      best = range;
    }
  }
  return best;
}

// A tie in weight goes to the type the Accept header lists first, and a
// tie from both types matching the same wildcard goes to the earlier
// entry in `offered`.
export function negotiate(
  header: string | null,
  offered: string[],
): string | null {
  const ranges = parseAccept(header ?? "");
  if (ranges.length === 0) {
    return offered[0] ?? null;
  }

  let chosen: { mediaType: string; range: MediaRange } | null = null;
  for (const mediaType of offered) {
    const range = bestMatch(ranges, mediaType);
    if (!range || range.q === 0) {
      continue;
    }
    if (
      !chosen ||
      range.q > chosen.range.q ||
      (range.q === chosen.range.q && range.position < chosen.range.position)
    ) {
      chosen = { mediaType, range };
    }
  }
  return chosen?.mediaType ?? null;
}
