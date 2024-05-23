package measure

import (
	"context"
	"errors"
	"fmt"
	"measure-backend/measure-go/server"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

type User struct {
	ID              *string    `json:"id"`
	Name            *string    `json:"name"`
	Email           *string    `json:"email"`
	InvitedByUserId *string    `json:"invited_by_user_id"`
	InvitedToTeamId *string    `json:"invited_to_team_id"`
	InvitedAsRole   *string    `json:"invited_as_role"`
	ConfirmedAt     *time.Time `json:"confirmed_at"`
	LastSignInAt    *time.Time `json:"last_sign_in_at"`
	CreatedAt       *time.Time `json:"created_at"`
	UpdatedAt       *time.Time `json:"updated_at"`
}

func (u User) String() string {
	return fmt.Sprintf(
		"ID: %s, Name: %s, Email: %s,Email: %s,InvitedByUserId: %s,InvitedToTeamId: %s InvitedAsRole: %v, LastSignInAt: %v, CreatedAt: %v, UpdatedAt: %v",
		stringOrNil(u.ID),
		stringOrNil(u.Name),
		stringOrNil(u.Email),
		stringOrNil(u.InvitedByUserId),
		stringOrNil(u.InvitedToTeamId),
		stringOrNil(u.InvitedAsRole),
		timeOrNil(u.ConfirmedAt),
		timeOrNil(u.LastSignInAt),
		timeOrNil(u.CreatedAt),
		timeOrNil(u.UpdatedAt),
	)
}

// Helper functions to handle nil pointers
func stringOrNil(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}

func timeOrNil(t *time.Time) string {
	if t == nil {
		return "<nil>"
	}
	return t.Format(time.RFC3339)
}

func CreateUser(c *gin.Context) {
	var user User

	if err := c.ShouldBindJSON(&user); err != nil {
		msg := "failed to parse user payload"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	selectStmt := sqlf.PostgreSQL.
		Select("id").
		From("public.users").
		Where("id = ?", user.ID)
	defer selectStmt.Close()

	var userIdFromDb string
	err := server.Server.PgPool.QueryRow(context.Background(), selectStmt.String(), selectStmt.Args()...).Scan(&userIdFromDb)

	// If there is no user for given userID, we create one
	if err != nil && err == pgx.ErrNoRows {
		insertStmt := sqlf.PostgreSQL.
			InsertInto("public.users").
			Set("id", user.ID).
			Set("name", user.Name).
			Set("email", user.Email).
			Set("invited_by_user_id", user.InvitedByUserId).
			Set("invited_to_team_id", user.InvitedToTeamId).
			Set("invited_as_role", user.InvitedAsRole).
			Set("confirmed_at", user.ConfirmedAt).
			Set("last_sign_in_at", user.LastSignInAt).
			Set("created_at", user.CreatedAt).
			Set("updated_at", user.UpdatedAt)
		defer insertStmt.Close()

		if _, err := server.Server.PgPool.Exec(context.Background(), insertStmt.String(), insertStmt.Args()...); err != nil {
			msg := "failed to create user in database"
			fmt.Println(msg, err)
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}

		c.JSON(http.StatusCreated, user)
		return
	}

	// If user exists for given userID, we updated the record
	updateStmt := sqlf.PostgreSQL.
		Update("public.users").
		Set("name", user.Name).
		Set("email", user.Email).
		Set("invited_by_user_id", user.InvitedByUserId).
		Set("invited_to_team_id", user.InvitedToTeamId).
		Set("invited_as_role", user.InvitedAsRole).
		Set("confirmed_at", user.ConfirmedAt).
		Set("last_sign_in_at", user.LastSignInAt).
		Set("created_at", user.CreatedAt).
		Set("updated_at", user.UpdatedAt).
		Where("id = ?", user.ID)
	defer updateStmt.Close()

	ctx := context.Background()
	if _, err := server.Server.PgPool.Exec(ctx, updateStmt.String(), updateStmt.Args()...); err != nil {
		msg := "failed to update user in database"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusCreated, user)
}

func (u *User) getTeams() ([]map[string]string, error) {
	stmt := sqlf.PostgreSQL.
		Select("team_membership.team_id, team_membership.role, teams.name").
		From("public.team_membership").
		LeftJoin("public.teams", "public.team_membership.team_id = teams.id").
		Where("public.team_membership.user_id = ?", nil)

	defer stmt.Close()

	rows, err := server.Server.PgPool.Query(context.Background(), stmt.String(), u.ID)

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

	if err := server.Server.PgPool.QueryRow(context.Background(), stmt.String(), u.ID).Scan(&team.ID, &team.Name); err != nil {
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
	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), u.ID, teamId).Scan(&role); err != nil {
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
// Only confirmed users are considered as viable candidates for
// team invitation.
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
		From("public.users").
		Where(fmt.Sprintf("email in (%s)", emailList)).
		Where("confirmed_at is not null")

	defer stmt.Close()

	rows, _ := server.Server.PgPool.Query(context.Background(), stmt.String())
	users, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (User, error) {
		var user User
		err := row.Scan(&user.ID, &user.Email)
		return user, err
	})
	if err != nil {
		return nil, nil, err
	}

	for _, invitee := range invitees {
		for _, user := range users {
			if strings.EqualFold(*user.Email, invitee.Email) {
				uuid, err := uuid.Parse(*user.ID)
				if err != nil {
					return nil, nil, err
				}
				invitee.ID = uuid
				oldUsers = append(oldUsers, invitee)
			}
		}
		newInvitee := true
		for _, user := range users {
			if strings.EqualFold(*user.Email, invitee.Email) {
				newInvitee = false
			}
		}

		if newInvitee {
			newUsers = append(newUsers, invitee)
		}
	}

	return oldUsers, newUsers, nil
}
