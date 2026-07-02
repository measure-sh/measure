// Package handlers is api's HTTP transport layer: the gin handlers that parse
// requests, call the shared domain logic in backend/libs/measure, and write
// responses. They reach Postgres, ClickHouse, Valkey and config through h.Deps
// rather than a package global. Only api imports this package, so gin stays
// out of the shared libs module.
package handlers

import "backend/api/server"

// Handlers groups api's gin HTTP handlers around the infrastructure they need.
// api's main builds one with New and registers its methods as routes.
type Handlers struct {
	Deps *server.Deps
}

// New returns a Handlers bound to the given infrastructure.
func New(deps *server.Deps) Handlers {
	return Handlers{Deps: deps}
}
