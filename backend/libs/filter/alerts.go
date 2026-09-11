package filter

// Alerts are scoped by app and time only, so the entity offers no keys and
// any filter_expr fails validation. Keys is empty rather than nil so a key
// listing encodes as an empty array.
var AlertsEntity = Entity{
	Name:    "alerts",
	Keys:    []Key{},
	BindKey: bindKeysToColumns(nil, nil),
}
