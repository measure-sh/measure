package mcp

import "backend/agent/server"

// Handlers groups the OAuth and MCP-transport HTTP handlers around the
// infrastructure they need. The agent process builds one with NewHandlers
// and registers its methods as routes, so the handlers reach Postgres,
// Valkey and config through h.Deps rather than a package global.
type Handlers struct {
	Deps *server.Deps
}

// NewHandlers returns a Handlers bound to the given infrastructure.
func NewHandlers(deps *server.Deps) Handlers {
	return Handlers{Deps: deps}
}
