package measure

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"slices"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	unknown Rank = iota
	viewer
	developer
	admin
	owner
)

var lowestRank = viewer

type Rank int

func (r *Rank) UnmarshalJSON(data []byte) error {
	var roleStr string

	if err := json.Unmarshal(data, &roleStr); err != nil {
		return err
	}

	role := RoleMap[roleStr]

	*r = role

	return nil
}

func (r *Rank) MarshalJSON() ([]byte, error) {
	return json.Marshal(r.String())
}

func (r Rank) getLower() []Rank {
	var ranks []Rank

	for i := int(r); i >= int(lowestRank); i-- {
		ranks = append(ranks, Rank(i))
	}

	return ranks
}

func (r Rank) Valid() bool {
	switch r {
	case viewer, developer, admin, owner:
		return true
	default:
		return false
	}
}

// IsUnknown reports whether the Rank is the zero/unknown role. Exported so
// handlers in other packages can detect the "no role" case without naming the
// unexported unknown constant.
func (r Rank) IsUnknown() bool {
	return r == unknown
}

// Value implements driver.Valuer so Rank is encoded as its role name
// (e.g. "owner") rather than the underlying int when used as a SQL
// parameter. pgx v5.9.2 stopped wrapping fmt.Stringer types ahead of
// the underlying int codec, which would otherwise insert "4" into
// varchar role columns and break the team_membership FK.
func (r Rank) Value() (driver.Value, error) {
	return r.String(), nil
}

func (r Rank) String() string {
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
	ScopeBugReportAll              = newScope("bugReport", "*")
	ScopeBugReportRead             = newScope("bugReport", "read")
)

type scope struct {
	resource string
	perm     string
}

func (s scope) GetRolesSameOrLower(r Rank) []Rank {
	lowerRoles := r.getLower()
	var roles []Rank

	if s == *ScopeTeamInviteSameOrLower {
		if slices.Contains(ScopeMap[r], s) || slices.Contains(ScopeMap[r], *ScopeTeamAll) {
			roles = append(roles, lowerRoles...)
		}
	}

	if s == *ScopeTeamChangeRoleSameOrLower {
		if slices.Contains(ScopeMap[r], s) || slices.Contains(ScopeMap[r], *ScopeTeamAll) {
			roles = append(roles, lowerRoles...)
		}
	}

	return roles
}

var ScopeMap = map[Rank][]scope{
	owner:     {*ScopeBillingAll, *ScopeTeamAll, *ScopeAlertAll, *ScopeAppAll, *ScopeBugReportAll},
	admin:     {*ScopeBillingAll, *ScopeAlertAll, *ScopeAppAll, *ScopeBugReportAll, *ScopeTeamInviteSameOrLower, *ScopeTeamChangeRoleSameOrLower},
	developer: {*ScopeBillingRead, *ScopeAlertAll, *ScopeAppRead, *ScopeBugReportAll, *ScopeTeamInviteSameOrLower, *ScopeTeamChangeRoleSameOrLower},
	viewer:    {*ScopeBillingRead, *ScopeAlertRead, *ScopeTeamRead, *ScopeTeamInviteSameOrLower, *ScopeAppRead, *ScopeBugReportRead},
}

var RoleMap = map[string]Rank{
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

func PerformAuthz(pg *pgxpool.Pool, uid string, rid string, scope scope) (bool, error) {
	u := &User{
		ID: &uid,
	}

	role, err := u.GetRole(pg, rid)
	if err != nil {
		return false, err
	}

	// no membership row for this user and team
	if role == unknown {
		return false, nil
	}
	roleScope := ScopeMap[role]

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
	case *ScopeBugReportAll:
		if slices.Contains(roleScope, *ScopeBugReportAll) {
			return true, nil
		}

		return false, nil
	case *ScopeBugReportRead:
		if slices.Contains(roleScope, *ScopeBugReportAll) {
			return true, nil
		}
		if slices.Contains(roleScope, *ScopeBugReportRead) {
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
