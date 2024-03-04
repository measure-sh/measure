package measure

import (
	"context"
	"errors"
	"fmt"
	"measure-backend/measure-go/server"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

type User struct {
	id    string
	email string
}

func (u *User) getTeams() ([]map[string]string, error) {
	stmt := sqlf.PostgreSQL.
		Select("team_membership.team_id, team_membership.role, teams.name").
		From("public.team_membership").
		LeftJoin("public.teams", "public.team_membership.team_id = teams.id").
		Where("public.team_membership.user_id = ?", nil)

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(context.Background(), stmt.String(), u.id)

	if err != nil {
		return nil, err
	}

	var teams []map[string]string

	for rows.Next() {
		var teamId, role, name string
		team := make(map[string]string)
		err := rows.Scan(&teamId, &role, &name)

		if err != nil {
			fmt.Println("Unable to scan team membership row", err)
			return nil, err
		}

		team["id"] = teamId
		team["name"] = name
		team["role"] = role
		teams = append(teams, team)
	}

	return teams, nil
}

func (u *User) getOwnTeam() (*Team, error) {
	stmt := sqlf.PostgreSQL.
		Select("teams.id, teams.name").
		From("public.teams").
		LeftJoin("public.team_membership", "public.teams.id = public.team_membership.team_id and public.team_membership.role = 'owner'").
		Where("public.team_membership.user_id = ?", nil)

	defer stmt.Close()

	team := &Team{}

	if err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), u.id).Scan(&team.ID, &team.Name); err != nil {
		return nil, err
	}

	return team, nil
}

func (u *User) getRole(teamId string) (rank, error) {
	var role string

	stmt := sqlf.PostgreSQL.
		Select("role").
		From("public.team_membership").
		Where("user_id::uuid = ? and team_id::uuid = ?", nil, nil)

	defer stmt.Close()

	ctx := context.Background()
	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), u.id, teamId).Scan(&role); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return unknown, nil
		} else {
			return unknown, err
		}
	}

	return roleMap[role], nil
}

// GetUsersByInvitees provides existing & new invitees by matching
// each user's and invitee's email.
//
// Only confirmed, not banned and not deleted users are considered as
// viable candidates for team invitation.
func GetUsersByInvitees(invitees []Invitee) ([]Invitee, []Invitee, error) {
	var oldUsers []Invitee
	var newUsers []Invitee
	var emailList string

	var emails []string
	for _, invitee := range invitees {
		emails = append(emails, fmt.Sprintf("'%s'", invitee.Email))
	}
	emailList = strings.Join(emails, ", ")

	stmt := sqlf.PostgreSQL.
		Select("id, email").
		From("auth.users").
		Where(fmt.Sprintf("email in (%s)", emailList)).
		Where("confirmed_at is not null").
		Where("deleted_at is null").
		Where("banned_until is null")

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(context.Background(), stmt.String())
	users, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (User, error) {
		var user User
		err := row.Scan(&user.id, &user.email)
		return user, err
	})
	if err != nil {
		return nil, nil, err
	}

	for _, invitee := range invitees {
		for _, user := range users {
			if strings.EqualFold(user.email, invitee.Email) {
				uuid, err := uuid.Parse(user.id)
				if err != nil {
					return nil, nil, err
				}
				invitee.ID = uuid
				oldUsers = append(oldUsers, invitee)
			}
		}
		newInvitee := true
		for _, user := range users {
			if strings.EqualFold(user.email, invitee.Email) {
				newInvitee = false
			}
		}

		if newInvitee {
			newUsers = append(newUsers, invitee)
		}
	}

	return oldUsers, newUsers, nil
}
