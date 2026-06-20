import type { HighlighterCore } from "shiki/core";

// Single source of truth for the code-block languages we support. Keys are the
// Shiki language ids; values are the fine-grained grammar imports, kept as
// static import() calls so the bundler still splits each grammar into its own
// lazily-loaded chunk (per https://shiki.style/guide/best-performance). The
// CodeBlockLanguage type, the runtime list, and the highlighter's lang set are
// all derived from this object, so they can't drift out of sync.
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

// Shiki recognises "plaintext" without a registered grammar; it renders code in
// the theme but with no token colours. We use it as the fallback for fenced
// blocks whose language we don't highlight, so they still get the CodeBlock
// chrome (theme background, copy button) rather than a bare box.
export const PLAINTEXT_LANGUAGE = "plaintext";

export type CodeBlockLanguage =
  | keyof typeof LANG_LOADERS
  | typeof PLAINTEXT_LANGUAGE;

// Runtime list of the languages we load grammars for, for callers that check
// whether a fenced block's language is one we can highlight. Plaintext is
// excluded since it's the fallback, not an author-selectable language.
export const CODE_BLOCK_LANGUAGES = Object.keys(
  LANG_LOADERS,
) as CodeBlockLanguage[];

export const CODE_BLOCK_THEME_LIGHT = "vitesse-light";
export const CODE_BLOCK_THEME_DARK = "vitesse-dark";

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
          import("@shikijs/themes/vitesse-light"),
          import("@shikijs/themes/vitesse-dark"),
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
