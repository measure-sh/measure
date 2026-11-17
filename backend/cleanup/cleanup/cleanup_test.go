package cleanup

import (
	"context"
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"slices"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// sqlf's Close is not idempotent. It nils the statement buffer then hands it
// to bytebufferpool, so a second Close faults on the nil buffer. Closing a
// statement both with a defer & explicitly on an error branch is exactly that
// double Close, since a defer inside a loop body does not run per iteration,
// it piles up & fires at function return.
func TestNoDeferredAndExplicitClose(t *testing.T) {
	file, err := parser.ParseFile(token.NewFileSet(), "cleanup.go", nil, 0)
	if err != nil {
		t.Fatalf("failed to parse cleanup.go: %v", err)
	}

	var funcs int

	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Body == nil {
			continue
		}

		funcs++

		deferred := map[string]bool{}
		explicit := map[string]bool{}

		ast.Inspect(fn.Body, func(n ast.Node) bool {
			// a defer inside a nested func literal has its own scope
			if _, ok := n.(*ast.FuncLit); ok {
				return false
			}

			switch stmt := n.(type) {
			case *ast.DeferStmt:
				if name, ok := closeTarget(stmt.Call); ok {
					deferred[name] = true
				}
			case *ast.ExprStmt:
				call, ok := stmt.X.(*ast.CallExpr)
				if !ok {
					return true
				}
				if name, ok := closeTarget(call); ok {
					explicit[name] = true
				}
			}

			return true
		})

		for name := range deferred {
			if explicit[name] {
				t.Errorf("%s: %s is closed by both a defer & an explicit call, sqlf Close is not idempotent", fn.Name.Name, name)
			}
		}
	}

	if funcs == 0 {
		t.Fatal("found no functions in cleanup.go, the check is not looking at what it thinks it is")
	}
}

// closeTarget returns the receiver name of an x.Close() call.
func closeTarget(call *ast.CallExpr) (name string, ok bool) {
	sel, ok := call.Fun.(*ast.SelectorExpr)
	if !ok || sel.Sel.Name != "Close" {
		return "", false
	}

	ident, ok := sel.X.(*ast.Ident)
	if !ok {
		return "", false
	}

	return ident.Name, true
}

type fakeS3 struct {
	calls [][]string
	out   *s3.DeleteObjectsOutput
	err   error
}

func (f *fakeS3) DeleteObjects(ctx context.Context, in *s3.DeleteObjectsInput, _ ...func(*s3.Options)) (*s3.DeleteObjectsOutput, error) {
	var keys []string
	for _, o := range in.Delete.Objects {
		keys = append(keys, aws.ToString(o.Key))
	}
	f.calls = append(f.calls, keys)
	if f.err != nil {
		return nil, f.err
	}
	if f.out != nil {
		return f.out, nil
	}
	return &s3.DeleteObjectsOutput{}, nil
}

func makeKeys(n int) []string {
	keys := make([]string, n)
	for i := range keys {
		keys[i] = fmt.Sprintf("k%d", i)
	}
	return keys
}

func TestDeleteS3Attachments(t *testing.T) {
	transportErr := errors.New("boom")
	perKey := &s3.DeleteObjectsOutput{Errors: []types.Error{{Key: aws.String("k0"), Code: aws.String("AccessDenied")}}}

	tests := []struct {
		name      string
		keys      int
		fake      *fakeS3
		wantSizes []int
		wantErrs  []error
	}{
		{"no keys sends nothing", 0, &fakeS3{}, nil, nil},
		{"2500 keys in 3 batches", 2500, &fakeS3{}, []int{1000, 1000, 500}, nil},
		{"per-key errors fail", 10, &fakeS3{out: perKey}, []int{10}, []error{ErrAttachmentDeleteFailure}},
		{"transport error stops later batches", 2500, &fakeS3{err: transportErr}, []int{1000}, []error{ErrAttachmentDeleteFailure, transportErr}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := deleteS3Attachments(context.Background(), tt.fake, "b", makeKeys(tt.keys))

			if len(tt.wantErrs) == 0 && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			for _, want := range tt.wantErrs {
				if !errors.Is(err, want) {
					t.Fatalf("error = %v, want wrapping %v", err, want)
				}
			}
			var sizes []int
			for _, c := range tt.fake.calls {
				sizes = append(sizes, len(c))
			}
			if !slices.Equal(sizes, tt.wantSizes) {
				t.Fatalf("batch sizes = %v, want %v", sizes, tt.wantSizes)
			}
		})
	}
}
