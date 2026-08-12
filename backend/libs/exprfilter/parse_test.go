package exprfilter

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

// The filter bar implements the same grammar in TypeScript and reads its cases
// from this file too, so a change to either parser fails here.
const corpusFile = "testdata/filter_test_expr_cases.json"

type parseCase struct {
	Name string    `json:"name"`
	Text string    `json:"text"`
	Tree *ExprTree `json:"tree"`
}

type refuseCase struct {
	Name     string `json:"name"`
	Text     string `json:"text"`
	Message  string `json:"message"`
	Position int    `json:"position"`
}

type corpus struct {
	Parse  []parseCase  `json:"parse"`
	Refuse []refuseCase `json:"refuse"`
	Format []parseCase  `json:"format"`
}

func readCorpus(t *testing.T) corpus {
	t.Helper()

	contents, err := os.ReadFile(corpusFile)
	if err != nil {
		t.Fatalf("cannot read %s: %v", corpusFile, err)
	}

	var read corpus
	if err := json.Unmarshal(contents, &read); err != nil {
		t.Fatalf("cannot read the cases in %s: %v", corpusFile, err)
	}
	return read
}

func TestParseFilter(t *testing.T) {
	for _, test := range readCorpus(t).Parse {
		t.Run(test.Name, func(t *testing.T) {
			got, err := ParseFilterExpr(test.Text)
			if err != nil {
				t.Fatalf("ParseFilterExpr(%q) failed: %v", test.Text, err)
			}
			if describe(got) != describe(test.Tree) {
				t.Errorf("ParseFilterExpr(%q)\n got %s\nwant %s", test.Text, describe(got), describe(test.Tree))
			}
		})
	}
}

func TestParseFilterRefuses(t *testing.T) {
	for _, test := range readCorpus(t).Refuse {
		t.Run(test.Name, func(t *testing.T) {
			_, err := ParseFilterExpr(test.Text)
			if err == nil {
				t.Fatalf("ParseFilterExpr(%q) was accepted", test.Text)
			}
			if !strings.Contains(err.Error(), test.Message) {
				t.Errorf("expected an error about %q, got %q", test.Message, err.Error())
			}

			parseErr, ok := err.(*ParseError)
			if !ok {
				t.Fatalf("expected a *ParseError, got %T", err)
			}
			if parseErr.Position != test.Position {
				t.Errorf("expected position %d, got %d (%q)", test.Position, parseErr.Position, err.Error())
			}
		})
	}
}

// The filter bar builds a tree and passes it on as text, so what
// FormatFilterExpr writes must parse back to the same tree.
func TestFormatFilterExprRoundTrips(t *testing.T) {
	for _, test := range readCorpus(t).Format {
		t.Run(test.Name, func(t *testing.T) {
			written := FormatFilterExpr(test.Tree)
			if written != test.Text {
				t.Fatalf("FormatFilterExpr wrote %q, want %q", written, test.Text)
			}

			read, err := ParseFilterExpr(written)
			if err != nil {
				t.Fatalf("ParseFilterExpr(%q) failed: %v", written, err)
			}
			if describe(read) != describe(test.Tree) {
				t.Errorf("round trip of %q\n got %s\nwant %s", written, describe(read), describe(test.Tree))
			}
		})
	}
}

func TestParseFilterRefusesOversizedText(t *testing.T) {
	const prefix = "version_name:in:"

	t.Run("a filter past the limit", func(t *testing.T) {
		text := prefix + strings.Repeat("a", MaxFilterBytes)

		if _, err := ParseFilterExpr(text); err == nil {
			t.Fatal("expected a filter past the length bound to be refused")
		}
	})

	// Each character in this value takes three bytes, so the filter reaches the
	// limit after only one-third as many characters as an ASCII-only value.
	t.Run("a filter whose value is Japanese", func(t *testing.T) {
		text := prefix + strings.Repeat("日", MaxFilterBytes/3)

		if _, err := ParseFilterExpr(text); err == nil {
			t.Fatal("expected a filter past the byte bound to be refused")
		}
	})
}

func describe(exprTree *ExprTree) string {
	if exprTree == nil {
		return "<nil>"
	}
	if condition := exprTree.Condition; condition != nil {
		return "{" + condition.KeyName + " " + string(condition.Operator) + " " + strings.Join(condition.TextValues(), "|") + "}"
	}

	parts := make([]string, len(exprTree.Children))
	for i := range exprTree.Children {
		parts[i] = describe(&exprTree.Children[i])
	}
	return "(" + string(exprTree.LogicalOperator) + " " + strings.Join(parts, " ") + ")"
}
