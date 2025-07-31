This project implements a Recursive Descent Parser for a subset of Google's Common Expression Language (CEL). It
implements a top-down parsing strategy where we build a set of mutually recursive functions to process input. Each
function is responsible for recognizing one specific part of our language's grammar. Let's break down how it works.

## CEL Expression Processing

The implementation follows a three-stage pipeline that evaluates raw CEL expressions:

**Tokenization → AST → Evaluation**

### Stage 1: Tokenization

The tokenizer performs lexical analysis, converting raw expression text into a sequence of meaningful tokens:

```kotlin
// Input: 'user.name == "john" && age > 21'
// Output: [IDENTIFIER("user"), DOT, IDENTIFIER("name"), EQUALS, STRING("john"), AND, IDENTIFIER("age"), GREATER_THAN, NUMBER("21")]
```

Key responsibilities:

- **Character-by-character scanning** with lookahead for multi-character operators (`==`, `&&`, etc.)
- **Token classification** into literals, operators, punctuation, and identifiers
- **Position tracking** for accurate error reporting during parsing/evaluation
- **Keyword recognition** for reserved words like `contains`, `startsWith`, `true`, `null`

### Stage 2: AST Construction

The parser transforms tokens into an Abstract Syntax Tree using recursive descent parsing:

```kotlin
// Tokens: [IDENTIFIER("age"), GREATER_THAN, NUMBER("21"), AND, IDENTIFIER("active"), EQUALS, BOOLEAN("true")]
// AST: LogicalOp(
//   left = BinaryOp(FieldAccess(["age"]), GREATER_THAN, Literal(Number(21))),
//   operator = AND,
//   right = BinaryOp(FieldAccess(["active"]), EQUALS, Literal(Boolean(true)))
// )
```

The AST nodes in CelExpression represent:

- **Literal**: Constants (`"hello"`, `42`, `true`, `null`)
- **FieldAccess**: Property navigation (`user.attributes.session_id`)
- **BinaryOp**: Comparisons and string operations (`==`, `contains`, `>`)
- **LogicalOp**: Boolean combinations (`&&`, `||`) with precedence handling

### Stage 3: Evaluation

The evaluator traverses the AST recursively, applying operations:

```kotlin
// AST + Event → Boolean result
// BinaryOp(FieldAccess(["user", "name"]), EQUALS, Literal("john"))
// With event.user.name = "john" → true
```

#### Recursive Decent Parsing

Recursive Decent parser is a "Top-down" parser. Meaning it starts parsing from the highest-level rule in the grammar and
works its way down to the lowest-level rules. In this case, it starts with the `OrExpression`.

```
OrExpression     ← Highest grammar level (handles ||)
  ↓
AndExpression    ← Handles &&
  ↓  
Comparison       ← Handles ==, >, contains
  ↓
Primary          ← Lowest grammar level (handles literals, parentheses)
```

Example, consider parsing: a == 1 || b > 2 && c == 3

1. OrExpression (top level) handles the || first, splitting into:

    ```
    Left: a == 1
    Right: b > 2 && c == 3
    ```
2. AndExpression handles the && on the right side, splitting into:

    ```
    Left: b > 2
    Right: c == 3
    
    ```

3. Comparison handles `==, >` in each part
4. Primary handles the actual values `a`, `1`, `b`, `2`, etc.

This ensures correct precedence: comparisons bind tighter than AND, which binds tighter than OR, exactly as expected in
most programming languages. The "top-down" approach naturally handles precedence by having lower-precedence operators at
higher grammar levels.

The call stack mirrors this descent:

```
parse()
└──> parseOrExpression()
     └──> parseAndExpression()
          └──> parseComparisonExpression()
               └──> parsePrimaryExpression()  <-- The base case
```

#### Field Access

`evaluateFieldAccess` resolves field access expressions like `gesture_click.target` or `attributes.session_id`. It
splits the identifier by dots and traverses the event object to retrieve the value. To make this possible
without reflection, the event object and all data objects like `GestureClickData` implement `CelFieldAccessor`
interface and provide a `getField` method that allows accessing nested fields by name.
