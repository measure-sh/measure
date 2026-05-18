import type { HighlighterCore } from "shiki/core";

export type CodeBlockLanguage =
  | "kotlin"
  | "xml"
  | "swift"
  | "dart"
  | "yaml"
  | "ruby"
  | "groovy"
  | "json"
  | "jsonc"
  | "objective-c"
  | "shellscript"
  | "java";

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
        langs: [
          import("@shikijs/langs/kotlin"),
          import("@shikijs/langs/xml"),
          import("@shikijs/langs/swift"),
          import("@shikijs/langs/dart"),
          import("@shikijs/langs/yaml"),
          import("@shikijs/langs/ruby"),
          import("@shikijs/langs/groovy"),
          import("@shikijs/langs/json"),
          import("@shikijs/langs/jsonc"),
          import("@shikijs/langs/objective-c"),
          import("@shikijs/langs/shellscript"),
          import("@shikijs/langs/java"),
        ],
        engine: createJavaScriptRegexEngine(),
      });
      resolvedHighlighter = highlighter;
      return highlighter;
    })();
  }
  return highlighterPromise;
}
