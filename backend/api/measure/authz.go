package measure

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
)

const (
	unknown rank = iota
	viewer
	developer
	admin
	owner
)

var lowestRank = viewer

type rank int

func (r *rank) UnmarshalJSON(data []byte) error {
	var roleStr string

	if err := json.Unmarshal(data, &roleStr); err != nil {
		return err
	}

	role := roleMap[roleStr]

	*r = role

	return nil
}

func (r *rank) MarshalJSON() ([]byte, error) {
	return json.Marshal(r.String())
}

func (r rank) getLower() []rank {
	var ranks []rank

	for i := int(r); i >= int(lowestRank); i-- {
		ranks = append(ranks, rank(i))
	}

	return ranks
}

func (r rank) Valid() bool {
	switch r {
	case viewer, developer, admin, owner:
		return true
	default:
		return false
	}
}

func (r rank) String() string {
	switch r {
	case viewer:
		return "viewer"
	case developer:
		return "developer"
	case admin:
		return "admin"
	case owner:
		return "owner"
	default:
		return "unknown"
	}
}

var (
	ScopeBillingAll                = newScope("billing", "*")
	ScopeBillingRead               = newScope("billing", "read")
	ScopeTeamAll                   = newScope("team", "*")
	ScopeTeamRead                  = newScope("team", "read")
	ScopeTeamInviteSameOrLower     = newScope("team", "inviteSameOrLower")
	ScopeTeamChangeRoleSameOrLower = newScope("team", "changeRoleSameOrLower")
	ScopeAlertAll                  = newScope("alert", "*")
	ScopeAlertRead                 = newScope("alert", "read")
	ScopeAppAll                    = newScope("app", "*")
	ScopeAppRead                   = newScope("app", "read")
)

type scope struct {
	resource string
	perm     string
}

func (s scope) getRolesSameOrLower(r rank) []rank {
	lowerRoles := r.getLower()
	var roles []rank

	if s == *ScopeTeamInviteSameOrLower {
		if slices.Contains(scopeMap[r], s) || slices.Contains(scopeMap[r], *ScopeTeamAll) {
			roles = append(roles, lowerRoles...)
		}
	}

	if s == *ScopeTeamChangeRoleSameOrLower {
		if slices.Contains(scopeMap[r], s) || slices.Contains(scopeMap[r], *ScopeTeamAll) {
			roles = append(roles, lowerRoles...)
		}
	}

	return roles
}

var scopeMap = map[rank][]scope{
	owner:     {*ScopeBillingAll, *ScopeTeamAll, *ScopeAlertAll, *ScopeAppAll},
	admin:     {*ScopeBillingAll, *ScopeAlertAll, *ScopeAppAll, *ScopeTeamInviteSameOrLower, *ScopeTeamChangeRoleSameOrLower},
	developer: {*ScopeBillingRead, *ScopeAlertAll, *ScopeAppAll, *ScopeTeamInviteSameOrLower, *ScopeTeamChangeRoleSameOrLower},
	viewer:    {*ScopeBillingRead, *ScopeAlertRead, *ScopeTeamRead, *ScopeTeamInviteSameOrLower, *ScopeAppRead},
}

var roleMap = map[string]rank{
	"owner":     owner,
	"admin":     admin,
	"developer": developer,
	"viewer":    viewer,
}

func (s *scope) String() string {
	return fmt.Sprintf("%s:%s", s.resource, s.perm)
}

func newScope(resource, perm string) *scope {
	return &scope{
		resource: resource,
		perm:     perm,
	}
}

func PerformAuthz(uid string, rid string, scope scope) (bool, error) {
	u := &User{
		ID: &uid,
	}

	role, err := u.getRole(rid)
	if err != nil {
		return false, err
	}

	if role == unknown {
		return false, errors.New("received 'unknown' role")
	}
	roleScope := scopeMap[role]

	switch scope {
	case *ScopeTeamRead:
		if slices.Contains(roleScope, *ScopeTeamAll) {
			return true, nil
		}
		if slices.Contains(roleScope, *ScopeTeamInviteSameOrLower) {
			return true, nil
		}
		if slices.Contains(roleScope, *ScopeTeamRead) {
			return true, nil
		}

		return false, nil
	case *ScopeAppAll:
		if slices.Contains(roleScope, *ScopeAppAll) {
			return true, nil
		}

		return false, nil
	case *ScopeAppRead:
		if slices.Contains(roleScope, *ScopeAppAll) {
			return true, nil
		}
		if slices.Contains(roleScope, *ScopeAppRead) {
			return true, nil
		}

		return false, nil
	case *ScopeTeamInviteSameOrLower:
		if slices.Contains(roleScope, *ScopeTeamAll) {
			return true, nil
		}
		if slices.Contains(roleScope, *ScopeTeamInviteSameOrLower) {
			return true, nil
		}
		return false, nil
	case *ScopeTeamChangeRoleSameOrLower:
		if slices.Contains(roleScope, *ScopeTeamAll) {
			return true, nil
		}
		if slices.Contains(roleScope, *ScopeTeamChangeRoleSameOrLower) {
			return true, nil
		}
		return false, nil
	case *ScopeTeamAll:
		if slices.Contains(roleScope, *ScopeTeamAll) {
			return true, nil
		}

		return false, nil
	case *ScopeBillingAll:
		if slices.Contains(roleScope, *ScopeBillingAll) {
			return true, nil
		}

		return false, nil
	case *ScopeBillingRead:
		if slices.Contains(roleScope, *ScopeBillingAll) {
			return true, nil
		}
		if slices.Contains(roleScope, *ScopeBillingRead) {
			return true, nil
		}

		return false, nil
	default:
		return false, nil
	}
}
