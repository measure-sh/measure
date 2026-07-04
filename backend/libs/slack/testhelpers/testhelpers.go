// Package testhelpers provides test-only mock helpers for swapping the
// package-level slack.X function variables, so tests can exercise code that
// posts to or reads from Slack without touching the network. Each helper saves
// the current value, installs the test's fn, and restores the original on test
// cleanup.
//
// Import as:
//
//	import slacktest "backend/libs/slack/testhelpers"
//
//	slacktest.MockUserEmail(t, func(ctx context.Context, token, userID string) (string, error) {
//	    return "someone@example.com", nil
//	})
package testhelpers

import (
	"context"
	"testing"

	"backend/libs/slack"
)

// MockPostMessage swaps slack.PostMessage for the duration of the test.
func MockPostMessage(t *testing.T, fn func(ctx context.Context, token, channel, threadTS, text string) (string, error)) {
	t.Helper()
	orig := slack.PostMessage
	slack.PostMessage = fn
	t.Cleanup(func() { slack.PostMessage = orig })
}

// MockUpdateMessage swaps slack.UpdateMessage for the duration of the test.
func MockUpdateMessage(t *testing.T, fn func(ctx context.Context, token, channel, ts, text string) error) {
	t.Helper()
	orig := slack.UpdateMessage
	slack.UpdateMessage = fn
	t.Cleanup(func() { slack.UpdateMessage = orig })
}

// MockUserEmail swaps slack.UserEmail for the duration of the test.
func MockUserEmail(t *testing.T, fn func(ctx context.Context, token, slackUserID string) (string, error)) {
	t.Helper()
	orig := slack.UserEmail
	slack.UserEmail = fn
	t.Cleanup(func() { slack.UserEmail = orig })
}

// MockConversationReplies swaps slack.ConversationReplies for the duration of the test.
func MockConversationReplies(t *testing.T, fn func(ctx context.Context, token, channel, threadTS, oldest string, limit int) ([]slack.Message, error)) {
	t.Helper()
	orig := slack.ConversationReplies
	slack.ConversationReplies = fn
	t.Cleanup(func() { slack.ConversationReplies = orig })
}

// MockConversationHistory swaps slack.ConversationHistory for the duration of the test.
func MockConversationHistory(t *testing.T, fn func(ctx context.Context, token, channel string, limit int) ([]slack.Message, error)) {
	t.Helper()
	orig := slack.ConversationHistory
	slack.ConversationHistory = fn
	t.Cleanup(func() { slack.ConversationHistory = orig })
}

// MockSetAssistantStatus swaps slack.SetAssistantStatus for the duration of the test.
func MockSetAssistantStatus(t *testing.T, fn func(ctx context.Context, token, channelID, threadTS, status string) error) {
	t.Helper()
	orig := slack.SetAssistantStatus
	slack.SetAssistantStatus = fn
	t.Cleanup(func() { slack.SetAssistantStatus = orig })
}

// MockSetAssistantTitle swaps slack.SetAssistantTitle for the duration of the test.
func MockSetAssistantTitle(t *testing.T, fn func(ctx context.Context, token, channelID, threadTS, title string) error) {
	t.Helper()
	orig := slack.SetAssistantTitle
	slack.SetAssistantTitle = fn
	t.Cleanup(func() { slack.SetAssistantTitle = orig })
}

// MockUploadFile swaps slack.UploadFile for the duration of the test.
func MockUploadFile(t *testing.T, fn func(ctx context.Context, token, channel, threadTS, filename, title string, content []byte) error) {
	t.Helper()
	orig := slack.UploadFile
	slack.UploadFile = fn
	t.Cleanup(func() { slack.UploadFile = orig })
}

// MockSetAssistantSuggestedPrompts swaps slack.SetAssistantSuggestedPrompts for the duration of the test.
func MockSetAssistantSuggestedPrompts(t *testing.T, fn func(ctx context.Context, token, channelID string, prompts []slack.SuggestedPrompt) error) {
	t.Helper()
	orig := slack.SetAssistantSuggestedPrompts
	slack.SetAssistantSuggestedPrompts = fn
	t.Cleanup(func() { slack.SetAssistantSuggestedPrompts = orig })
}
