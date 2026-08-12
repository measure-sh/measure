package exprfilter

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

const DefaultDuration = time.Hour * 24 * 7

const DefaultPaginationLimit = 10

const MaxPaginationLimit = 1000

type ExprFilter struct {
	AppID  uuid.UUID
	TeamID uuid.UUID

	// Entity must be set before Validate.
	Entity Entity

	From     time.Time `form:"from" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`
	To       time.Time `form:"to" time_format:"2006-01-02T15:04:05.000Z" time_utc:"1"`
	Timezone string    `form:"timezone"`

	Limit  int `form:"limit"`
	Offset int `form:"offset"`

	// FilterExpr is the text form of the filter, as a link or an API request
	// carries it. ExprTree is the parsed form.
	FilterExpr string `form:"filter_expr"`

	ExprTree *ExprTree
}

func (ef *ExprFilter) HasFilterExpr() bool {
	return ef.ExprTree != nil
}

func (ef *ExprFilter) HasTimeRange() bool {
	return !ef.From.IsZero() && !ef.To.IsZero()
}

func (ef *ExprFilter) SetDefaultTimeRange() {
	to := time.Now().UTC()
	ef.From = to.Add(-DefaultDuration)
	ef.To = to
}

func (ef *ExprFilter) BuildExprTree() error {
	if ef.FilterExpr == "" {
		ef.ExprTree = nil
		return nil
	}

	exprTree, err := ParseFilterExpr(ef.FilterExpr)
	if err != nil {
		return err
	}

	ef.ExprTree = exprTree
	return nil
}

func (ef *ExprFilter) Validate() error {
	if ef.AppID == uuid.Nil {
		return errors.New("App id is invalid or empty")
	}

	if ef.From.IsZero() != ef.To.IsZero() {
		return errors.New("Both `from` and `to` time must be set")
	}
	if ef.To.Before(ef.From) {
		return errors.New("`to` must be later time than `from`")
	}
	if ef.From.After(time.Now().UTC()) {
		return errors.New("`from` cannot be later than now")
	}

	if ef.Limit < 1 {
		return errors.New("`limit` must be at least 1")
	}
	if ef.Limit > MaxPaginationLimit {
		return fmt.Errorf("`limit` cannot be more than %d", MaxPaginationLimit)
	}
	if ef.Offset < 0 {
		return errors.New("`offset` cannot be negative")
	}

	if !ef.HasFilterExpr() {
		return nil
	}

	if ef.Entity.Name == "" {
		return errors.New("Filter entity is not set")
	}

	return ValidateFilterExpr(ef.ExprTree, IndexKeysByName(ef.Entity.Keys))
}
