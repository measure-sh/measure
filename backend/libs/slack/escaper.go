package slack

import "strings"

// mrkdwnEscaper rewrites the three characters Slack parses as markup in
// mrkdwn text into their HTML entities. The & rule comes first so a literal
// "&lt;" in the input escapes its ampersand instead of being matched by a
// later rule.
var mrkdwnEscaper = strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;")

// mrkdwnUnescaper is the inverse of mrkdwnEscaper.
var mrkdwnUnescaper = strings.NewReplacer("&lt;", "<", "&gt;", ">", "&amp;", "&")

// EscapeMrkdwn escapes the characters Slack parses as markup in mrkdwn text:
// < and > delimit links and mentions, and & starts an entity. Without
// escaping, text like "<init>" disappears from the rendered message, and a
// planted "<!channel>" would ping the channel with the bot's authority.
func EscapeMrkdwn(s string) string {
	return mrkdwnEscaper.Replace(s)
}

// UnescapeMrkdwn undoes the entity encoding Slack applies to message text on
// the way in, so a reader gets ">" where the user typed it instead of "&gt;".
func UnescapeMrkdwn(s string) string {
	return mrkdwnUnescaper.Replace(s)
}
