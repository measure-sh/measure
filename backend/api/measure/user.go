package measure

import (
	"backend/api/server"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/leporo/sqlf"
)

type User struct {
	ID           *string    `json:"id"`
	Name         *string    `json:"name"`
	Email        *string    `json:"email"`
	ConfirmedAt  *time.Time `json:"confirmed_at"`
	LastSignInAt *time.Time `json:"last_sign_in_at"`
	CreatedAt    *time.Time `json:"created_at"`
	UpdatedAt    *time.Time `json:"updated_at"`
}

func (u User) String() string {
	return fmt.Sprintf(
		"ID: %s, Name: %s, Email: %s, ConfirmedAt: %s, LastSignInAt: %v, CreatedAt: %v, UpdatedAt: %v",
		stringOrNil(u.ID),
		stringOrNil(u.Name),
		stringOrNil(u.Email),
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

func (u *User) getTeams() ([]map[string]string, error) {
	stmt := sqlf.PostgreSQL.
		Select("team_membership.team_id, team_membership.role, teams.name").
		From("team_membership").
		LeftJoin("teams", "team_membership.team_id = teams.id").
		Where("team_membership.user_id = ?", nil)

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

// getOwnTeam gets a user's own team.
func (u *User) getOwnTeam(ctx context.Context) (team *Team, err error) {
	stmt := sqlf.PostgreSQL.
		Select("teams.id, teams.name").
		From("teams").
		LeftJoin("team_membership", "teams.id = team_membership.team_id and team_membership.role = 'owner'").
		Where("team_membership.user_id = ?", u.ID).
		OrderBy("team_membership.created_at").
		Limit(1)

	defer stmt.Close()

	team = &Team{}

	if err = server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&team.ID, &team.Name); err != nil {
		return
	}

	return
}

func (u *User) getRole(teamId string) (rank, error) {
	var role string

	stmt := sqlf.PostgreSQL.
		Select("role").
		From("team_membership").
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

// save saves a user to database.
func (u *User) save(ctx context.Context, tx *pgx.Tx) (err error) {
	stmt := sqlf.PostgreSQL.
		InsertInto("users").
		Set("id", u.ID).
		Set("name", u.Name).
		Set("email", u.Email).
		Set("confirmed_at", u.ConfirmedAt).
		Set("last_sign_in_at", u.LastSignInAt).
		Set("created_at", u.CreatedAt).
		Set("updated_at", u.UpdatedAt)

	defer stmt.Close()

	if tx != nil {
		_, err = (*tx).Exec(ctx, stmt.String(), stmt.Args()...)
		return
	}

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// firstName returns the first name of the
// user.
func (u *User) firstName() (firstName string) {
	parts := strings.Fields(*u.Name)
	if len(parts) > 0 {
		firstName = parts[0]
	}
	return
}

// touchLastSignInAt updates the last sign in at
// value for the user.
func (u *User) touchLastSignInAt(ctx context.Context) (err error) {
	stmt := sqlf.PostgreSQL.
		Update("users").
		Set("last_sign_in_at", time.Now()).
		Where("id = ?", u.ID)

	defer stmt.Close()

	_, err = server.Server.PgPool.Exec(ctx, stmt.String(), stmt.Args()...)

	return
}

// getEmail retrieves the email address of the user.
func (u *User) getEmail(ctx context.Context) (err error) {
	stmt := sqlf.PostgreSQL.
		From("users").
		Select("email").
		Where("id = ?", nil)

	defer stmt.Close()

	err = server.Server.PgPool.QueryRow(ctx, stmt.String(), u.ID).Scan(&u.Email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("user not found")
		}
		return fmt.Errorf("failed to retrieve email: %w", err)
	}

	return
}

// getUser retrieves the user details from the database.
func (u *User) getUserDetails(ctx context.Context) (err error) {
	stmt := sqlf.PostgreSQL.
		From("users").
		Select("id").
		Select("name").
		Select("email").
		Select("confirmed_at").
		Select("last_sign_in_at").
		Select("created_at").
		Select("updated_at").
		Where("id = ?", nil)

	defer stmt.Close()

	err = server.Server.PgPool.QueryRow(ctx, stmt.String(), u.ID).Scan(&u.ID, &u.Name, &u.Email, &u.ConfirmedAt, &u.LastSignInAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("user not found")
		}
		return fmt.Errorf("failed to retrieve user: %w", err)
	}

	return
}

// GetExistingAndNewInvitees provides existing & new invitees by matching
// each user's and invitee's email.
//
// Only confirmed users are considered as viable candidates for
// team invitation.
func GetExistingAndNewInvitees(invitees []Invitee) ([]Invitee, []Invitee, error) {
	var existingInvitees []Invitee
	var newInvitees []Invitee
	var emailList string

	var emails []string
	for _, invitee := range invitees {
		emails = append(emails, fmt.Sprintf("'%s'", invitee.Email))
	}
	emailList = strings.Join(emails, ", ")

	stmt := sqlf.PostgreSQL.
		Select("id, email").
		From("users").
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
				existingInvitees = append(existingInvitees, invitee)
			}
		}
		newInvitee := true
		for _, user := range users {
			if strings.EqualFold(*user.Email, invitee.Email) {
				newInvitee = false
			}
		}

		if newInvitee {
			newInvitees = append(newInvitees, invitee)
		}
	}

	return existingInvitees, newInvitees, nil
}

// FindUserByEmail finds a user from their email.
func FindUserByEmail(ctx context.Context, email string) (*User, error) {
	stmt := sqlf.PostgreSQL.
		From("users").
		Select("id").
		Select("name").
		Select("email").
		Where("email = ?", email)

	defer stmt.Close()

	var user User

	if err := server.Server.PgPool.QueryRow(ctx, stmt.String(), stmt.Args()...).Scan(&user.ID, &user.Name, &user.Email); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}

		return nil, err
	}

	return &user, nil
}

// NewUser creates a new user from name
// and email pair.
func NewUser(name, email string) (user *User) {
	id := uuid.New().String()
	now := time.Now()
	user = &User{
		ID:           &id,
		Name:         &name,
		Email:        &email,
		ConfirmedAt:  &now,
		LastSignInAt: &now,
		CreatedAt:    &now,
		UpdatedAt:    &now,
	}

	return
}
