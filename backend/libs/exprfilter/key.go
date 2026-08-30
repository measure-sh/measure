package exprfilter

// ValueSuggestionMode says which values the filter bar offers for a key
type ValueSuggestionMode string

const (
	// ValueSuggestionModeFullList means the key's values are a fixed set the
	// filter bar lists in full. Nothing outside the set is accepted.
	ValueSuggestionModeFullList ValueSuggestionMode = "full_list"

	// ValueSuggestionModeSample means the key's values too many to list.
	// The bar shows the most recent ones and accepts anything else that is typed.
	ValueSuggestionModeSample ValueSuggestionMode = "sample"

	// ValueSuggestionModeNone means there is nothing to suggest and the value is
	// typed, as for a size or a substring match.
	ValueSuggestionModeNone ValueSuggestionMode = "none"
)

// KeyGroup is the heading a key is offered under in the filter bar.
type KeyGroup string

// Key is one thing a person can filter on. Name is the stable identifier a
// filter expression carries.
type Key struct {
	Name                string              `json:"name"`
	Label               string              `json:"label"`
	Description         string              `json:"description"`
	KeyGroup            KeyGroup            `json:"key_group"`
	ValueType           ValueType           `json:"value_type"`
	Operators           []Operator          `json:"operators"`
	ValueSuggestionMode ValueSuggestionMode `json:"value_suggestion_mode"`

	// EnumValues is the fixed set of values a ValueTypeEnum key accepts.
	EnumValues []string `json:"-"`
}

// ValueRequest is one request for a key's values: what has been typed so far,
// and how many values to return.
type ValueRequest struct {
	Search string
	Limit  int
}

// effectiveLimit is the requested limit, or DefaultValueLimit when the
// request does not name one.
func (r ValueRequest) effectiveLimit() int {
	if r.Limit <= 0 {
		return DefaultValueLimit
	}
	return r.Limit
}

// ValueList is the answer to a ValueRequest. Truncated says more values matched
// than the list holds.
type ValueList struct {
	Values    []Value
	Truncated bool
}

const DefaultValueLimit = 50

const MaxValueLimit = 200

func IndexKeysByName(keys []Key) map[string]Key {
	byName := make(map[string]Key, len(keys))
	for _, key := range keys {
		byName[key.Name] = key
	}
	return byName
}
