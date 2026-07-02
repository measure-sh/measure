package measure

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AddNewUserToInvitedTeams adds a newly-signed-up user to any teams they were
// invited to, then clears those invites.
func AddNewUserToInvitedTeams(ctx context.Context, pg *pgxpool.Pool, userId string, email string) error {
	invites, err := GetValidInvitesForEmail(ctx, pg, email)
	if err != nil {
		return err
	}

	// Add user to invited teams
	for _, invite := range invites {
		invitedToTeam := &Team{
			ID: &invite.InvitedToTeamId,
		}

		invitee := &Invitee{
			ID:    uuid.MustParse(userId),
			Email: invite.Email,
			Role:  invite.InvitedAsRole,
		}
		invitees := []Invitee{*invitee}
		if err := invitedToTeam.AddMembers(ctx, pg, invitees); err != nil {
			return err
		}
		// remove the invite after adding the user
		if err := invitedToTeam.RemoveInvite(ctx, pg, invite.ID); err != nil {
			return err
		}
	}

	return nil
}
