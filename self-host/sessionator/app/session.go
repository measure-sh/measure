package app

// Session represents the session for parsing and reading
// certain resource fields.
type Session struct {
	SessionID string   `json:"session_id" binding:"required"`
	Resource  Resource `json:"resource" binding:"required"`
}
