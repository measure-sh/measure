import type {
  ExprTree,
  ExprTreeCondition,
  FilterOperator,
  FilterValue,
} from "../../api/filter_types";
import { MAX_FILTER_BYTES } from "./limits";

// A filter is written as text. This file reads that text into a tree, and
// writes a tree back out as text.
//
//	filter    = or
//	or        = and { "OR" and }
//	and       = operand { "AND" operand }
//	operand   = "(" or ")" | condition
//	condition = key ":" operator [ ":" values ]
//	values    = value | "[" value { "," value } "]"
//	value     = word | quoted
//
// AND binds tighter than OR, so a AND b OR c means (a AND b) OR c.
//
//	version_name:in:[1.2.0,1.1.9] AND mapping_type:not_in:jsbundle
//	patch_id:is_set OR version_name:starts_with:1.2.
//	(version_name:contains:SNAPSHOT AND mapping_type:in:proguard) OR patch_id:is_set
//
// A value holding a space, a comma, a bracket, a colon or a quote is written
// in double quotes, with \" and \\ inside:
//
//	version_name:in:"1.2.0 (beta)"
//
// The server reads and writes the same grammar in
// backend/libs/exprfilter/parse.go. The two are separate implementations,
// held to the same behaviour by the cases in
// backend/libs/exprfilter/testdata/filter_test_expr_cases.json, which the tests
// on both sides read. Draft mode is the one behaviour this parser has and the
// server's does not; see ParseOptions.

// Position is the offset of a character in the filter, counted from zero.
// Counting characters instead of bytes keeps a position lined up with the
// text on screen when a value holds multi-byte characters.
export type ParseError = {
  message: string;
  position: number;
};

export type TokenKind =
  | "key"
  | "operator"
  | "value"
  | "logical"
  | "paren"
  | "punctuation";

export type ExprToken = {
  kind: TokenKind;
  start: number;
  end: number;
  text: string;
};

// Tokens come back whether or not the filter could be read; on failure they
// hold everything up to the point where reading stopped.
export type ParseOutcome =
  | { ok: true; tree: ExprTree; tokens: ExprToken[] }
  | { ok: false; error: ParseError; tokens: ExprToken[] };

export type ParseOptions = {
  // Accept the two incomplete forms the filter bar uses while a filter is
  // being built: a condition whose values are still to be picked, written
  // `key:operator:`, and an empty group, written `()`. The server rejects
  // both forms, so a filter carried by a request can contain neither.
  draft?: boolean;
};

// ─── Reading ─────────────────────────────────────────────────────────────

/**
 * Read the text form of a filter into a tree. It only checks that the text is well
 * formed; whether the keys and operators exist, and whether
 * the values suit them, is validation's job.
 */
export function parseFilterExpr(
  text: string,
  options: ParseOptions = {},
): ParseOutcome {
  if (new TextEncoder().encode(text).length > MAX_FILTER_BYTES) {
    return {
      ok: false,
      error: {
        message: `Filter is longer than ${MAX_FILTER_BYTES} bytes`,
        position: 0,
      },
      tokens: [],
    };
  }

  const parser = new Parser(text, options.draft ?? false);
  try {
    return { ok: true, tree: parser.parseFilter(), tokens: parser.tokens };
  } catch (thrown) {
    if (thrown instanceof ParseFailure) {
      return { ok: false, error: thrown.error, tokens: parser.tokens };
    }
    throw thrown;
  }
}

// Quotes text for an error message the way Go's %q does, so both parsers
// report the same message for the same input.
function quote(text: string): string {
  return JSON.stringify(text);
}

// Thrown to unwind the parser from wherever it gave up. parseFilterExpr
// catches it and returns the error it carries.
class ParseFailure extends Error {
  error: ParseError;

  constructor(error: ParseError) {
    super(`${error.message} at position ${error.position}`);
    this.error = error;
  }
}

// One part of the filter as parsed, along with whether it was written in
// parentheses. The tree does not preserve this distinction because a group
// has the same meaning either way, but draft mode needs it; see
// `parseOperand` and `parseFilter`.
type Operand = {
  tree: ExprTree;
  parenthesised: boolean;
};

/**
 * Reads the text a character at a time. Everything it reads is delimited by
 * punctuation or space and there is no separate lexing pass.
 */
class Parser {
  // Split into Unicode code points rather than UTF-16 code units, so characters
  // such as emoji count as one position instead of two.
  private readonly runes: string[];
  private at = 0;
  private readonly draft: boolean;

  readonly tokens: ExprToken[] = [];

  constructor(text: string, draft: boolean) {
    this.runes = Array.from(text);
    this.draft = draft;
  }

  parseFilter(): ExprTree {
    this.skipSpace();
    if (this.done()) {
      throw this.failAt("Filter is empty", 0);
    }

    const operand = this.parseOr();

    this.skipSpace();
    if (!this.done()) {
      throw this.fail(`Unexpected ${quote(this.peek())}`);
    }

    // The filter bar draws the top level as its own group, so a draft consisting
    // of a single parenthesised group needs an outer group. Otherwise, the
    // parentheses the user typed become the top level, and the bar has no group
    // to draw a box for.
    if (this.draft && operand.parenthesised) {
      return { logical_operator: "and", children: [operand.tree] };
    }
    return operand.tree;
  }

  private parseOr(): Operand {
    const first = this.parseAnd();

    const children = [first.tree];
    while (this.takeWord("OR")) {
      children.push(this.parseAnd().tree);
    }

    if (children.length === 1) {
      return first;
    }
    return { tree: { logical_operator: "or", children }, parenthesised: false };
  }

  private parseAnd(): Operand {
    const first = this.parseOperand();

    const children = [first.tree];
    while (this.takeWord("AND")) {
      children.push(this.parseOperand().tree);
    }

    if (children.length === 1) {
      return first;
    }
    return {
      tree: { logical_operator: "and", children },
      parenthesised: false,
    };
  }

  private parseOperand(): Operand {
    this.skipSpace();
    if (this.done()) {
      throw this.fail("Filter ends where a condition was expected");
    }

    if (this.peek() !== "(") {
      return this.parseCondition();
    }

    this.takeCharacter("paren");

    if (this.draft) {
      this.skipSpace();
      if (!this.done() && this.peek() === ")") {
        this.takeCharacter("paren");
        return {
          tree: { logical_operator: "and", children: [] },
          parenthesised: true,
        };
      }
    }

    const inner = this.parseOr();

    this.skipSpace();
    if (this.done() || this.peek() !== ")") {
      throw this.fail("Group is not closed");
    }
    this.takeCharacter("paren");

    // Parentheses around a single condition become a group so the grouping the
    // client wrote survives the round trip; because that group has no siblings,
    // its operator is arbitrary. Draft mode also preserves a group around a
    // group, because the filter bar draws a box for each group the user opened.
    // Outside draft mode, nested parentheses collapse to a single group, which
    // is how the server represents them.
    const inserts =
      inner.tree.condition !== undefined || (this.draft && inner.parenthesised);

    if (inserts) {
      return {
        tree: { logical_operator: "and", children: [inner.tree] },
        parenthesised: true,
      };
    }
    return { tree: inner.tree, parenthesised: true };
  }

  private parseCondition(): Operand {
    const key = this.parseWord("key");
    this.pushToken("key", key.start, this.at);

    if (this.done() || this.peek() !== ":") {
      throw this.fail(
        `Key ${quote(key.text)} needs an operator, written ${key.text}:operator`,
      );
    }
    this.takeCharacter("punctuation");

    const operator = this.parseWord("operator");
    this.pushToken("operator", operator.start, this.at);

    const condition: ExprTreeCondition = {
      key_name: key.text,
      operator: operator.text as FilterOperator,
    };

    if (!this.done() && this.peek() === ":") {
      this.takeCharacter("punctuation");
      condition.values = this.parseDraftOrValues();
    }

    return { tree: { condition }, parenthesised: false };
  }

  // The filter bar writes a condition with no values selected as `key:operator:`.
  // Values are therefore pending when the text ends after the colon or continues
  // with a delimiter that cannot start a value.
  private parseDraftOrValues(): FilterValue[] {
    const pending =
      this.done() ||
      (isDelimiter(this.peek()) && this.peek() !== "[" && this.peek() !== '"');

    if (this.draft && pending) {
      return [];
    }
    return this.parseValues();
  }

  // Reads either a single value or a bracketed list of values. A lone value
  // must immediately follow its operator; allowing a space would make
  // `a:in: AND b:in:2` interpret `AND` as the missing value.
  private parseValues(): FilterValue[] {
    if (this.done() || this.peek() !== "[") {
      return [this.parseValue()];
    }
    this.takeCharacter("punctuation");

    const values: FilterValue[] = [];
    for (;;) {
      this.skipSpace();
      values.push(this.parseValue());

      this.skipSpace();
      if (this.done()) {
        throw this.fail("List of values is not closed");
      }

      if (this.peek() === ",") {
        this.takeCharacter("punctuation");
        continue;
      }
      if (this.peek() === "]") {
        this.takeCharacter("punctuation");
        return values;
      }
      throw this.fail(`Unexpected ${quote(this.peek())} in a list of values`);
    }
  }

  private parseValue(): FilterValue {
    if (this.done()) {
      throw this.fail("Expected a value");
    }

    const start = this.at;

    if (this.peek() === '"') {
      const text = this.parseQuoted();
      this.pushToken("value", start, this.at);
      return { text };
    }

    while (!this.done() && !isDelimiter(this.peek())) {
      this.at++;
    }
    if (this.at === start) {
      throw this.fail("Expected a value");
    }

    this.pushToken("value", start, this.at);
    return { text: this.slice(start, this.at) };
  }

  private parseQuoted(): string {
    const opened = this.at;
    this.at++;

    let text = "";
    while (!this.done()) {
      const c = this.peek();

      if (c === "\\") {
        this.at++;
        if (this.done()) {
          break;
        }
        text += this.peek();
        this.at++;
        continue;
      }

      if (c === '"') {
        this.at++;
        return text;
      }

      text += c;
      this.at++;
    }

    throw this.failAt("Quoted value is not closed", opened);
  }

  private parseWord(what: string): { text: string; start: number } {
    this.skipSpace();

    const start = this.at;
    while (!this.done() && !isDelimiter(this.peek())) {
      this.at++;
    }
    if (this.at === start) {
      throw this.fail(`Expected a ${what}`);
    }

    return { text: this.slice(start, this.at), start };
  }

  // Reads the next keyword when one starts at the current position. Keywords
  // are case-insensitive and must stand alone, so a value like "android" is
  // not mistaken for the keyword `AND`.
  private takeWord(word: string): boolean {
    this.skipSpace();

    const end = this.at + word.length;
    if (end > this.runes.length) {
      return false;
    }
    if (this.slice(this.at, end).toLowerCase() !== word.toLowerCase()) {
      return false;
    }
    if (end < this.runes.length && !isDelimiter(this.runes[end])) {
      return false;
    }

    this.pushToken("logical", this.at, end);
    this.at = end;
    return true;
  }

  private takeCharacter(kind: TokenKind) {
    this.pushToken(kind, this.at, this.at + 1);
    this.at++;
  }

  private pushToken(kind: TokenKind, start: number, end: number) {
    this.tokens.push({ kind, start, end, text: this.slice(start, end) });
  }

  private slice(start: number, end: number): string {
    return this.runes.slice(start, end).join("");
  }

  private skipSpace() {
    while (!this.done() && isSpace(this.peek())) {
      this.at++;
    }
  }

  private done(): boolean {
    return this.at >= this.runes.length;
  }

  private peek(): string {
    return this.runes[this.at];
  }

  private fail(message: string): ParseFailure {
    return new ParseFailure({ message, position: this.at });
  }

  private failAt(message: string, position: number): ParseFailure {
    return new ParseFailure({ message, position });
  }
}

// ─── Writing ─────────────────────────────────────────────────────────────

/**
 * Serialize the tree so parsing the result preserves its structure, including
 * explicit groups.
 */
export function formatFilterExpr(exprTree: ExprTree | null): string {
  if (!exprTree) {
    return "";
  }
  if (exprTree.condition) {
    return formatCondition(exprTree.condition);
  }

  const parts = (exprTree.children ?? []).map((child) =>
    child.condition ? formatFilterExpr(child) : `(${formatFilterExpr(child)})`,
  );

  return parts.join(exprTree.logical_operator === "or" ? " OR " : " AND ");
}

function formatCondition(condition: ExprTreeCondition): string {
  const written = `${condition.key_name}:${condition.operator}`;

  if (!condition.values) {
    return written;
  }
  // An empty `values` array means the condition's values have not been picked
  // yet; `undefined` means the operator takes no values. The trailing colon is
  // what `parseDraftOrValues` reads back as pending.
  if (condition.values.length === 0) {
    return `${written}:`;
  }

  const texts = condition.values.map((value) => formatValue(value.text));
  if (texts.length === 1) {
    return `${written}:${texts[0]}`;
  }
  return `${written}:[${texts.join(",")}]`;
}

// Quotes a value that could not be read back unquoted.
function formatValue(text: string): string {
  const plain = text !== "" && ![...text].some(isDelimiter);
  if (plain) {
    return text;
  }
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// ─── Characters ──────────────────────────────────────────────────────────

const delimiters = new Set([":", ",", "[", "]", "(", ")", '"']);

// The characters Go's unicode.IsSpace reports, so both parsers split a filter
// into the same words. JavaScript's own \s cannot stand in, because it omits
// the next-line character U+0085 and includes the byte order mark U+FEFF.
const spaces =
  /[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/;

function isSpace(c: string): boolean {
  return spaces.test(c);
}

function isDelimiter(c: string): boolean {
  return delimiters.has(c) || isSpace(c);
}
