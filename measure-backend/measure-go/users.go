package main

import (
	"context"
	"fmt"
)

type User struct {
	id string
}

func (u *User) getTeams() ([]map[string]string, error) {
	rows, err := server.pgPool.Query(context.Background(), "select team_membership.team_id, team_membership.role, teams.name from team_membership left outer join teams on team_membership.team_id = teams.id where team_membership.user_id::uuid = $1;", u.id)

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

		team["teamId"] = teamId
		team["name"] = name
		team["role"] = role
		teams = append(teams, team)
	}

	return teams, nil
}
