import type { HighlighterCore } from "shiki/core";

// Single source of truth for the code-block languages we support. Keys are the
// Shiki language ids; values are the fine-grained grammar imports, kept as
// static import() calls so the bundler still splits each grammar into its own
// lazily-loaded chunk (per https://shiki.style/guide/best-performance). The
// CodeBlockLanguage type and the highlighter's lang set are both derived from
// this object, so they can't drift out of sync.
const LANG_LOADERS = {
  kotlin: () => import("@shikijs/langs/kotlin"),
  xml: () => import("@shikijs/langs/xml"),
  swift: () => import("@shikijs/langs/swift"),
  dart: () => import("@shikijs/langs/dart"),
  yaml: () => import("@shikijs/langs/yaml"),
  ruby: () => import("@shikijs/langs/ruby"),
  groovy: () => import("@shikijs/langs/groovy"),
  json: () => import("@shikijs/langs/json"),
  jsonc: () => import("@shikijs/langs/jsonc"),
  "objective-c": () => import("@shikijs/langs/objective-c"),
  shellscript: () => import("@shikijs/langs/shellscript"),
  java: () => import("@shikijs/langs/java"),
  typescript: () => import("@shikijs/langs/typescript"),
  c: () => import("@shikijs/langs/c"),
} as const;

export type CodeBlockLanguage = keyof typeof LANG_LOADERS;

// Same pair fumadocs uses for the docs code blocks, so code looks the
// same in the dashboard and the docs.
export const CODE_BLOCK_THEME_LIGHT = "github-light";
export const CODE_BLOCK_THEME_DARK = "github-dark";

// Drop the themes' own backgrounds so the component chrome paints them,
// the way docs code blocks do (fumadocs ignores the theme background and
// uses its card token). Without this, dark mode shows github-dark's
// #24292e as a gray box on the near-black app background. Replacements
// match exact color strings anywhere in the theme; github-dark also uses
// #24292e as the foreground of its carriage-return token, so a literal CR
// would render transparent, which is accepted.
export const CODE_BLOCK_COLOR_REPLACEMENTS: Record<
  string,
  Record<string, string>
> = {
  [CODE_BLOCK_THEME_LIGHT]: { "#fff": "transparent" },
  [CODE_BLOCK_THEME_DARK]: { "#24292e": "transparent" },
};

let highlighterPromise: Promise<HighlighterCore> | null = null;
let resolvedHighlighter: HighlighterCore | null = null;

// Synchronous accessor for the already-loaded highlighter. Returns null
// until loadHighlighter() resolves the first time. CodeBlock uses this in
// useState's initializer so a remount after Shiki has loaded once paints
// highlighted HTML on the very first frame — no fallback flash.
export function getLoadedHighlighter(): HighlighterCore | null {
  return resolvedHighlighter;
}

// Lazy singleton. The first caller pays the dynamic-import + grammar-load
// cost; every subsequent call resolves to the same instance, so re-renders
// and other CodeBlocks on the same page reuse a single highlighter.
//
// Uses shiki/core + the JS regex engine + fine-grained language/theme
// imports (per https://shiki.style/guide/best-performance) to keep the
// chunk small and skip the WASM Oniguruma runtime.
export function loadHighlighter(): Promise<HighlighterCore> {
  if (highlighterPromise === null) {
    highlighterPromise = (async () => {
      const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] =
        await Promise.all([
          import("shiki/core"),
          import("shiki/engine/javascript"),
        ]);
      const highlighter = await createHighlighterCore({
        themes: [
          import("@shikijs/themes/github-light"),
          import("@shikijs/themes/github-dark"),
        ],
        langs: Object.values(LANG_LOADERS).map((load) => load()),
        engine: createJavaScriptRegexEngine(),
      });
      resolvedHighlighter = highlighter;
      return highlighter;
    })();
  }
  return highlighterPromise;
}
