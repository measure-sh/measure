package exprfilter

import (
	"fmt"
	"strings"
	"unicode"
)

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

// ParseError says what could not be read and where.
type ParseError struct {
	Message string
	// Position is the offset of the character in the filter, counted from zero.
	Position int
}

func (e *ParseError) Error() string {
	return fmt.Sprintf("%s at position %d", e.Message, e.Position)
}

// --------------------------------------------------------------------------
// Parsing
// --------------------------------------------------------------------------

// ParseFilterExpr reads the text form of a filter into a tree. It checks that
// the text is well formed and nothing else; whether the keys and operators
// exist, and whether the values suit them, is validation's job.
func ParseFilterExpr(text string) (*ExprTree, error) {
	if len(text) > MaxFilterBytes {
		// The whole filter is too long, so no one character in it is the
		// problem and the position stays at the start.
		return nil, &ParseError{
			Message: fmt.Sprintf("Filter is longer than %d bytes", MaxFilterBytes),
		}
	}

	p := &parser{runes: []rune(text)}
	p.skipSpace()
	if p.done() {
		return nil, &ParseError{Message: "Filter is empty", Position: 0}
	}

	expr, err := p.parseOr()
	if err != nil {
		return nil, err
	}

	p.skipSpace()
	if !p.done() {
		return nil, p.errorf("Unexpected %q", string(p.peek()))
	}

	return expr, nil
}

// parser reads the text a rune at a time. Everything it reads is delimited by
// punctuation or space, so there is no separate lexing pass.
type parser struct {
	runes []rune
	at    int
}

func (p *parser) parseOr() (*ExprTree, error) {
	first, err := p.parseAnd()
	if err != nil {
		return nil, err
	}

	children := []ExprTree{*first}
	for p.takeWord("OR") {
		next, err := p.parseAnd()
		if err != nil {
			return nil, err
		}
		children = append(children, *next)
	}

	if len(children) == 1 {
		return first, nil
	}
	return &ExprTree{LogicalOperator: LogicalOr, Children: children}, nil
}

func (p *parser) parseAnd() (*ExprTree, error) {
	first, err := p.parseOperand()
	if err != nil {
		return nil, err
	}

	children := []ExprTree{*first}
	for p.takeWord("AND") {
		next, err := p.parseOperand()
		if err != nil {
			return nil, err
		}
		children = append(children, *next)
	}

	if len(children) == 1 {
		return first, nil
	}
	return &ExprTree{LogicalOperator: LogicalAnd, Children: children}, nil
}

func (p *parser) parseOperand() (*ExprTree, error) {
	p.skipSpace()
	if p.done() {
		return nil, p.errorf("Filter ends where a condition was expected")
	}

	if p.peek() == '(' {
		p.at++
		inner, err := p.parseOr()
		if err != nil {
			return nil, err
		}
		p.skipSpace()
		if p.done() || p.peek() != ')' {
			return nil, p.errorf("Group is not closed")
		}
		p.at++
		// Parenthesize groups even when they contain one condition so the client's grouping
		// survives serialization.
		if !inner.IsGroup() {
			return &ExprTree{LogicalOperator: LogicalAnd, Children: []ExprTree{*inner}}, nil
		}
		return inner, nil
	}

	return p.parseCondition()
}

// parseCondition reads key:operator and the values the operator takes.
func (p *parser) parseCondition() (*ExprTree, error) {
	p.skipSpace()
	position := p.at

	key, err := p.parseWord("key")
	if err != nil {
		return nil, err
	}

	if p.done() || p.peek() != ':' {
		return nil, p.errorf("Key %q needs an operator, written %s:operator", key, key)
	}
	p.at++

	name, err := p.parseWord("operator")
	if err != nil {
		return nil, err
	}

	condition := &Condition{KeyName: key, Operator: Operator(name), TextPosition: position}

	if !p.done() && p.peek() == ':' {
		p.at++
		values, err := p.parseValues()
		if err != nil {
			return nil, err
		}
		condition.Values = values
	}

	condition.TextEnd = p.at

	return &ExprTree{Condition: condition}, nil
}

// parseValues reads either one value or a bracketed list of them. A lone value
// must follow its operator with no space, because allowing a space would let
// "a:in: AND b:in:2" read AND as the missing value.
func (p *parser) parseValues() ([]Value, error) {
	if p.done() || p.peek() != '[' {
		value, err := p.parseValue()
		if err != nil {
			return nil, err
		}
		return []Value{value}, nil
	}

	p.at++
	values := []Value{}
	for {
		p.skipSpace()
		value, err := p.parseValue()
		if err != nil {
			return nil, err
		}
		values = append(values, value)

		p.skipSpace()
		if p.done() {
			return nil, p.errorf("List of values is not closed")
		}
		switch p.peek() {
		case ',':
			p.at++
		case ']':
			p.at++
			return values, nil
		default:
			return nil, p.errorf("Unexpected %q in a list of values", string(p.peek()))
		}
	}
}

func (p *parser) parseValue() (Value, error) {
	if p.done() {
		return Value{}, p.errorf("Expected a value")
	}

	if p.peek() == '"' {
		return p.parseQuoted()
	}

	start := p.at
	for !p.done() && !isDelimiter(p.peek()) {
		p.at++
	}
	if p.at == start {
		return Value{}, p.errorf("Expected a value")
	}

	return Value{Text: string(p.runes[start:p.at])}, nil
}

func (p *parser) parseQuoted() (Value, error) {
	opened := p.at
	p.at++

	var text strings.Builder
	for !p.done() {
		switch c := p.peek(); c {
		case '\\':
			p.at++
			if p.done() {
				break
			}
			text.WriteRune(p.peek())
			p.at++
		case '"':
			p.at++
			return Value{Text: text.String()}, nil
		default:
			text.WriteRune(c)
			p.at++
		}
	}

	return Value{}, &ParseError{Message: "Quoted value is not closed", Position: opened}
}

func (p *parser) parseWord(what string) (string, error) {
	p.skipSpace()

	start := p.at
	for !p.done() && !isDelimiter(p.peek()) {
		p.at++
	}
	if p.at == start {
		return "", p.errorf("Expected a %s", what)
	}

	return string(p.runes[start:p.at]), nil
}

// takeWord consumes word when it appears at the current
// position as a standalone keyword so a value of "android"
// is not read as the keyword "AND".
func (p *parser) takeWord(word string) bool {
	p.skipSpace()

	end := p.at + len([]rune(word))
	if end > len(p.runes) {
		return false
	}
	if !strings.EqualFold(string(p.runes[p.at:end]), word) {
		return false
	}
	if end < len(p.runes) && !isDelimiter(p.runes[end]) {
		return false
	}

	p.at = end
	return true
}

func (p *parser) skipSpace() {
	for !p.done() && unicode.IsSpace(p.peek()) {
		p.at++
	}
}

func (p *parser) done() bool {
	return p.at >= len(p.runes)
}

func (p *parser) peek() rune {
	return p.runes[p.at]
}

func (p *parser) errorf(format string, args ...any) *ParseError {
	return &ParseError{Message: fmt.Sprintf(format, args...), Position: p.at}
}

// isDelimiter reports whether a character ends a key, an operator or an
// unquoted value. Everything else is part of one token, so a version like
// 1.2.0-SNAPSHOT.debug can be written without quotes.
func isDelimiter(c rune) bool {
	switch c {
	case ':', ',', '[', ']', '(', ')', '"':
		return true
	}
	return unicode.IsSpace(c)
}

// --------------------------------------------------------------------------
// Formatting
// --------------------------------------------------------------------------

// Serialize the tree so parsing the result preserves its structure,
// including explicit groups.
func FormatFilterExpr(exprTree *ExprTree) string {
	if exprTree == nil {
		return ""
	}

	if exprTree.Condition != nil {
		return formatCondition(*exprTree.Condition)
	}

	parts := make([]string, len(exprTree.Children))
	for i := range exprTree.Children {
		child := &exprTree.Children[i]
		if child.IsGroup() {
			parts[i] = "(" + FormatFilterExpr(child) + ")"
			continue
		}
		parts[i] = FormatFilterExpr(child)
	}

	return strings.Join(parts, " "+strings.ToUpper(exprTree.LogicalOperator.String())+" ")
}

func formatCondition(condition Condition) string {
	written := condition.KeyName + ":" + string(condition.Operator)
	if len(condition.Values) == 0 {
		return written
	}

	texts := make([]string, len(condition.Values))
	for i, value := range condition.Values {
		texts[i] = formatValue(value.Text)
	}

	if len(texts) == 1 {
		return written + ":" + texts[0]
	}
	return written + ":[" + strings.Join(texts, ",") + "]"
}

// formatValue quotes a value that can't be parsed back unquoted.
func formatValue(text string) string {
	plain := text != ""
	for _, c := range text {
		if isDelimiter(c) {
			plain = false
			break
		}
	}
	if plain {
		return text
	}

	quoted := strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(text)
	return `"` + quoted + `"`
}
