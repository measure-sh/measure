package agent

import (
	"backend/agent/server"
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"backend/libs/autumn"
	"backend/libs/concur"

	"github.com/google/uuid"
	"github.com/leporo/sqlf"
)

// agentNotAllowedReply is shown on both surfaces (Slack and MCP) when the team
// has reached its agent usage allowance. dashboard is the word "dashboard",
// linked to the team's usage page (dashboardLink).
func agentNotAllowedReply(dashboard string) string {
	return fmt.Sprintf("Your team has reached its agent usage limit. Please go to the Measure %s to see plan upgrade options.", dashboard)
}

// checkAgentAllowed asks Autumn whether the team is allowed to use the agent.
// Returns nil if allowed; fail-open on any dependency error so a transient
// Autumn outage does not block customers. A non-nil return always means the
// limit is reached; surfaces answer it with agentNotAllowedReply. The verdict
// is cached (autumn.CheckCached).
func (c *Config) checkAgentAllowed(ctx context.Context, customerID string) error {
	deps := c.Deps
	if !deps.Config.IsBillingEnabled() || customerID == "" {
		return nil
	}

	allowed, err := autumn.CheckCached(ctx, deps.VK, customerID, autumn.FeatureAgentTokens)
	if err != nil {
		if autumn.IsServerOrNetworkError(err) {
			log.Printf("agent check: autumn unavailable, failing open (customer=%s): %v", customerID, err)
		} else {
			log.Printf("ERROR agent check: autumn client error, check config (customer=%s): %v", customerID, err)
		}
		return nil // fail open: a billing outage shouldn't take the agent down
	}
	if !allowed {
		log.Printf("agent: usage blocked, plan limit reached (customer=%s)", customerID)
		return errors.New("agent usage limit reached")
	}
	return nil
}

// trackAgentTokens reports token usage to Autumn in the background, which prices
// it from its model catalog. model is the bare slug we call (e.g.
// "openai/gpt-5.5"); every agent model is served through OpenRouter and Autumn
// keys its pricing on the OpenRouter-namespaced id, so it is prefixed here.
// Autumn prices cache and reasoning tokens in their own pools, so the input and
// output counts sent here exclude them, or those tokens would be billed twice.
// Errors are only logged. context.Background() keeps it running after the
// request ends; the wait group lets shutdown wait for it.
func trackAgentTokens(deps *server.Deps, customerID, model string, usage tokenUsage) {
	if !deps.Config.IsBillingEnabled() || customerID == "" || (usage.prompt <= 0 && usage.completion <= 0) {
		return
	}
	modelID := model
	if !strings.HasPrefix(modelID, "openrouter/") {
		modelID = "openrouter/" + modelID
	}
	concur.GlobalWg.Go(func() {
		ctx := context.Background()
		// input/output are the plain text pools: prompt and completion with the
		// cache and reasoning counts removed, since Autumn prices those in their
		// own pools and would otherwise bill them twice. They are subsets of
		// prompt/completion, so the remainder can't go negative in practice; the
		// clamp guards against a provider that reports them inconsistently.
		err := autumn.TrackTokens(ctx, autumn.TrackTokensRequest{
			CustomerID:       customerID,
			FeatureID:        autumn.FeatureAgentTokens,
			ModelID:          modelID,
			InputTokens:      max(0, usage.prompt-usage.cacheRead-usage.cacheWrite),
			OutputTokens:     max(0, usage.completion-usage.reasoning),
			CacheReadTokens:  usage.cacheRead,
			CacheWriteTokens: usage.cacheWrite,
			ReasoningTokens:  usage.reasoning,
		})
		if err != nil {
			if autumn.IsServerOrNetworkError(err) {
				log.Printf("agent track: Autumn unavailable, dropping (customer=%s): %v", customerID, err)
			} else {
				log.Printf("ERROR agent track: client error, check config (customer=%s): %v", customerID, err)
			}
		}
	})
}

// resolveAppsAccess verifies every app exists, all belong to one team, and
// the user is a member of that team. It returns the team's id and Autumn
// customer id.
func (c *Config) resolveAppsAccess(ctx context.Context, userID uuid.UUID, appIDs []uuid.UUID) (teamID uuid.UUID, customerID string, err error) {
	if len(appIDs) == 0 {
		return uuid.Nil, "", fmt.Errorf("no apps given")
	}

	deps := c.Deps
	// pgx has no encode plan for []uuid.UUID; pass strings and cast.
	ids := uuid.UUIDs(appIDs).Strings()
	stmt := sqlf.PostgreSQL.
		Select("a.id, t.id, t.autumn_customer_id").
		From("apps a").
		Join("teams t", "a.team_id = t.id").
		Join("team_membership tm", "tm.team_id = t.id").
		Where("a.id = any(?::uuid[])", ids).
		Where("tm.user_id = ?", userID)
	defer stmt.Close()

	rows, err := deps.PgPool.Query(ctx, stmt.String(), stmt.Args()...)
	if err != nil {
		return uuid.Nil, "", err
	}
	defer rows.Close()

	found := map[uuid.UUID]bool{}
	teams := map[uuid.UUID]bool{}
	for rows.Next() {
		var appID, appTeamID uuid.UUID
		var autumnCustomerID *string
		if err := rows.Scan(&appID, &appTeamID, &autumnCustomerID); err != nil {
			return uuid.Nil, "", err
		}
		found[appID] = true
		teams[appTeamID] = true
		teamID = appTeamID
		if autumnCustomerID != nil {
			customerID = *autumnCustomerID
		}
	}
	if err := rows.Err(); err != nil {
		return uuid.Nil, "", err
	}

	for _, appID := range appIDs {
		if !found[appID] {
			return uuid.Nil, "", fmt.Errorf("app not found or access denied")
		}
	}
	if len(teams) > 1 {
		return uuid.Nil, "", fmt.Errorf("all apps must belong to one team")
	}
	return teamID, customerID, nil
}
