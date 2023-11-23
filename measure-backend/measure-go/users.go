package main

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

type User struct {
	id string
}

func (u *User) getTeams() ([]map[string]string, error) {
	rows, err := server.PgPool.Query(context.Background(), "select team_membership.team_id, team_membership.role, teams.name from team_membership left outer join teams on team_membership.team_id = teams.id where team_membership.user_id::uuid = $1;", u.id)

	if err != nil {
		fmt.Println(err)
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

func (u *User) getRole(teamId string) (rank, error) {
	var role string
	if err := server.PgPool.QueryRow(context.Background(), "select team_membership.role from team_membership where user_id::uuid = $1 and team_id::uuid = $2;", u.id, teamId).Scan(&role); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return unknown, nil
		} else {
			return unknown, err
		}
	}

	return roleMap[role], nil
}
