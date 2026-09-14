package filter

// Alerts are scoped by app and time only, so the entity offers no keys and
// any filter_expr fails validation. Keys is an empty slice so a key listing
// encodes as an empty array.
var AlertsEntity = Entity{
	Name:    "alerts",
	Keys:    []Key{},
	Columns: &Columns{dialect: dialectClickHouse},
}
