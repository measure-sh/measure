package handlers

import (
	"fmt"
	"net/http"
	"slices"

	"backend/libs/measure"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h Handlers) GetAuthzRoles(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	user := &measure.User{
		ID: &userId,
	}

	userRole, err := user.GetRole(deps.PgPool, teamId.String())
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole.IsUnknown() {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamRead)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have read permissions to team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	team := measure.Team{
		ID: &teamId,
	}

	members, err := team.GetMembers(ctx, deps.PgPool)
	if err != nil {
		msg := `failed to retrieve team members`
		fmt.Println(msg, err)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})

		return
	}

	var membersWithAuthz []measure.MemberWithAuthz

	for _, member := range members {
		var memberWithAuthz measure.MemberWithAuthz
		memberWithAuthz.Member = *member
		memberRole := measure.RoleMap[*member.Role]
		if userRole >= memberRole {
			canChangeRoles := measure.ScopeTeamChangeRoleSameOrLower.GetRolesSameOrLower(userRole)
			memberWithAuthz.CurrentUserAssignableRolesForMember = canChangeRoles
			if len(canChangeRoles) > 0 {
				memberWithAuthz.CurrentUserCanRemoveMember = true
			}
		}

		membersWithAuthz = append(membersWithAuthz, memberWithAuthz)
	}

	inviteeRoles := measure.ScopeTeamInviteSameOrLower.GetRolesSameOrLower(userRole)

	canChangeBilling := deps.Config.IsBillingEnabled() && slices.Contains(measure.ScopeMap[userRole], *measure.ScopeBillingAll)
	canCreateApp := slices.Contains(measure.ScopeMap[userRole], *measure.ScopeAppAll)
	canRenameApp := slices.Contains(measure.ScopeMap[userRole], *measure.ScopeAppAll)
	canChangeRetention := slices.Contains(measure.ScopeMap[userRole], *measure.ScopeAppAll)
	canRotateApiKey := slices.Contains(measure.ScopeMap[userRole], *measure.ScopeAppAll)
	canWriteSdkConfig := slices.Contains(measure.ScopeMap[userRole], *measure.ScopeAppAll)
	canRenameTeam := slices.Contains(measure.ScopeMap[userRole], *measure.ScopeTeamAll)
	canManageSlack := slices.Contains(measure.ScopeMap[userRole], *measure.ScopeTeamAll)
	canChangeAppThresholdPrefs := slices.Contains(measure.ScopeMap[userRole], *measure.ScopeAppAll)
	canUpdateBugReports := slices.Contains(measure.ScopeMap[userRole], *measure.ScopeBugReportAll)

	c.JSON(http.StatusOK, gin.H{
		"can_invite_roles":               inviteeRoles,
		"can_update_bug_reports":         canUpdateBugReports,
		"can_change_billing":             canChangeBilling,
		"can_create_app":                 canCreateApp,
		"can_rename_app":                 canRenameApp,
		"can_change_retention":           canChangeRetention,
		"can_rotate_api_key":             canRotateApiKey,
		"can_write_sdk_config":           canWriteSdkConfig,
		"can_rename_team":                canRenameTeam,
		"can_manage_slack":               canManageSlack,
		"can_change_app_threshold_prefs": canChangeAppThresholdPrefs,
		"members":                        membersWithAuthz,
	})
}
