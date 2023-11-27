package main

import (
	"fmt"
	"slices"
)

type rank int

const (
	unknown rank = iota
	viewer
	developer
	admin
	owner
)

var (
	ScopeBillingAll                = newScope("billing", "*")
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

var scopeMap = map[rank][]scope{
	owner:     {*ScopeBillingAll, *ScopeTeamAll, *ScopeAlertAll, *ScopeAppAll},
	admin:     {*ScopeBillingAll, *ScopeAlertAll, *ScopeAppAll, *ScopeTeamInviteSameOrLower, *ScopeTeamChangeRoleSameOrLower},
	developer: {*ScopeAlertAll, *ScopeAppAll, *ScopeTeamInviteSameOrLower, *ScopeTeamChangeRoleSameOrLower},
	viewer:    {*ScopeAlertRead, *ScopeTeamRead, *ScopeTeamInviteSameOrLower, *ScopeAppRead},
}

var roleMap = map[string]rank{
	"owner":     owner,
	"admin":     admin,
	"developer": developer,
	"viewer":    viewer,
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
		id: uid,
	}

	role, err := u.getRole(rid)
	if err != nil {
		return false, err
	}
	roleScope := scopeMap[role]

	switch scope {
	case *ScopeTeamRead:
		if slices.Contains(roleScope, *ScopeTeamAll) {
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
	default:
		return false, nil
	}
}
