package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"backend/libs/email"
	"backend/libs/measure"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const maxInvitees = 25

// normalizeTeamName trims a bound team name and reports whether it is usable.
// A missing field (nil) or a value that is blank after trimming is rejected.
func normalizeTeamName(name *string) (string, bool) {
	if name == nil {
		return "", false
	}
	trimmed := strings.TrimSpace(*name)
	return trimmed, trimmed != ""
}

func (h Handlers) CreateTeam(c *gin.Context) {
	deps := h.Deps
	ctx := c.Request.Context()
	userId := c.GetString("userId")
	u := &measure.User{
		ID: &userId,
	}

	newTeam := &measure.Team{}

	if err := c.ShouldBindJSON(newTeam); err != nil {
		msg := "failed to parse create team request body"
		fmt.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg, "details": err})
		return
	}

	name, ok := normalizeTeamName(newTeam.Name)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team name cannot be empty"})
		return
	}
	*newTeam.Name = name

	msg := "failed to create team"
	tx, err := deps.PgPool.Begin(ctx)
	if err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	defer tx.Rollback(ctx)

	if err := newTeam.Create(ctx, deps.PgPool, deps.Config.IsBillingEnabled(), u, &tx); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   msg,
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, newTeam)
}

func (h Handlers) GetTeams(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	u := &measure.User{
		ID: &userId,
	}

	teams, err := u.GetTeams(deps.PgPool)
	if err != nil {
		msg := "failed to fetch teams for user"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if len(teams) < 1 {
		msg := `no teams found`
		fmt.Println(msg)
		c.JSON(http.StatusNotFound, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, teams)
}

func (h Handlers) GetTeamApps(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeAppRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read apps in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var team = new(measure.Team)
	team.ID = &teamId

	apps, err := team.GetApps(c.Request.Context(), deps.PgPool)
	if err != nil {
		msg := fmt.Sprintf("error occurred while querying apps list for team: %s", teamId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if len(apps) < 1 {
		msg := fmt.Sprintf("no apps exists under team: %s", teamId)
		c.JSON(http.StatusNotFound, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, apps)
}

func (h Handlers) GetTeamApp(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	appId, err := uuid.Parse(c.Param("appId"))
	if err != nil {
		msg := `app id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions for team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	if ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeAppRead); err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	} else if !ok {
		msg := fmt.Sprintf(`you don't have permissions to read apps in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	a := measure.NewApp(teamId)
	a, err = a.GetWithTeam(deps.PgPool, appId)
	if err != nil {
		msg := fmt.Sprintf("failed to fetch app: %s", appId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if a == nil {
		msg := fmt.Sprintf("no app found with id: %s", appId)
		c.JSON(http.StatusNotFound, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, &a)
}

// GetValidInvitesForEmail retrieves valid invites for a given email address
func (h Handlers) InviteMembers(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}
	var invitees []measure.Invitee

	if err := c.ShouldBindJSON(&invitees); err != nil {
		msg := "failed to parse invite payload"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	if len(invitees) < 1 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "need at least 1 invitee",
		})
		return
	}

	if len(invitees) > maxInvitees {
		msg := fmt.Sprintf("cannot invite more than %d invitee(s)", maxInvitees)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamInviteSameOrLower)
	if err != nil {
		// FIXME: improve error handling, this is quite brittle way of
		// doing errors. not ideal.
		if err.Error() == "received 'unknown' role" {
			msg := `couldn't find team, perhaps team id is invalid`
			fmt.Println(msg)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": msg,
			})
			return
		}
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to invite in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	user := &measure.User{
		ID: &userId,
	}

	userRole, err := user.GetRole(deps.PgPool, teamId.String())
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if userRole.IsUnknown() {
		msg := `couldn't find team, perhaps team id is invalid`
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	var inviteeRoles []measure.Rank
	for _, r := range invitees {
		inviteeRoles = append(inviteeRoles, r.Role)
	}
	maxInviteeRole := slices.Max(inviteeRoles)

	if maxInviteeRole > userRole {
		msg := fmt.Sprintf(`you don't have permissions to invite in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	team := measure.Team{
		ID: &teamId,
	}

	idx, err := team.AreInviteesMember(c.Request.Context(), deps.PgPool, invitees)
	if err != nil {
		msg := `failed to check if invitees are already members of the team`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if idx > -1 {
		email := invitees[idx].Email
		msg := fmt.Sprintf("invitee '%s' is already a member of this team", email)
		c.JSON(http.StatusConflict, gin.H{
			"error": msg,
		})
		return
	}

	existingInvitees, newInvitees, err := measure.GetExistingAndNewInvitees(deps.PgPool, invitees)
	if err != nil {
		msg := `failed to fetch existing and new invitees`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	err = team.GetName(c.Request.Context(), deps.PgPool)
	if err != nil {
		msg := `failed to fetch team name. Unable to send invites for new users`
		fmt.Println(msg, err)
	}

	err = user.GetEmail(c.Request.Context(), deps.PgPool)
	if err != nil {
		msg := `failed to fetch user email. Unable to send invites for new users`
		fmt.Println(msg, err)
	}

	// Handle existing invitees
	if len(existingInvitees) > 0 {
		if err := team.AddMembers(c.Request.Context(), deps.PgPool, existingInvitees); err != nil {
			msg := `failed to add existing invitees to team`
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg,
			})
			return
		}

		// Send emails to exisiting invitees
		for _, invitee := range existingInvitees {
			subject, body := email.AddedToTeamEmail(*team.Name, invitee.Role.String(), *user.Email, deps.Config.SiteOrigin, teamId.String())

			email.SendEmail(deps.Mail, email.EmailInfo{
				From:        deps.Config.TxEmailAddress,
				To:          invitee.Email,
				Subject:     subject,
				ContentType: "text/html",
				Body:        body,
			})
		}
	}

	// Handle new invitees
	if len(newInvitees) > 0 {
		inviteeEmailToInviteIdMap, err := team.AddInvites(c.Request.Context(), deps.PgPool, userId, newInvitees)
		if err != nil {
			msg := `failed to create invites for new users: `
			fmt.Println(msg, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": msg + ": " + err.Error(),
			})
			return
		}

		// Send emails to new invitees
		for _, invitee := range newInvitees {
			inviteId, ok := inviteeEmailToInviteIdMap[invitee.Email]
			if !ok {
				fmt.Printf("Warning: invite ID not found for %s\n", invitee.Email)
				continue
			}

			days := int(measure.TeamInviteValidity.Hours() / 24)
			subject, body := email.InviteNewUserEmail(*user.Email, invitee.Role.String(), *team.Name, days, deps.Config.SiteOrigin, inviteId.String())

			email.SendEmail(deps.Mail, email.EmailInfo{
				From:        deps.Config.TxEmailAddress,
				To:          invitee.Email,
				Subject:     subject,
				ContentType: "text/html",
				Body:        body,
			})
		}
	}

	existingInvitedEmails := []string{}
	newInvitedEmails := []string{}
	for i := range existingInvitees {
		existingInvitedEmails = append(existingInvitedEmails, existingInvitees[i].Email)
	}
	for i := range newInvitees {
		newInvitedEmails = append(newInvitedEmails, newInvitees[i].Email)
	}
	existingEmails := strings.Join(existingInvitedEmails, ", ")
	newEmails := strings.Join(newInvitedEmails, ", ")

	if len(existingInvitees) > 0 && len(newInvitees) > 0 {
		c.JSON(http.StatusOK, gin.H{
			"ok": fmt.Sprintf("Added %s and invited %s", existingEmails, newEmails),
		})
	} else if len(existingInvitees) > 0 {
		c.JSON(http.StatusOK, gin.H{
			"ok": fmt.Sprintf("Added %s", existingEmails),
		})
	} else if len(newInvitees) > 0 {
		c.JSON(http.StatusOK, gin.H{
			"ok": fmt.Sprintf("Invited %s", newEmails),
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"ok": "No users were added or invited",
		})
	}
}

func (h Handlers) GetValidTeamInvites(c *gin.Context) {
	deps := h.Deps
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

	team := &measure.Team{
		ID: &teamId,
	}

	invites, err := team.GetValidInvites(c.Request.Context(), deps.PgPool)
	if err != nil {
		msg := "failed to query invites"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, invites)
}

func (h Handlers) ResendInvite(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}
	inviteId, err := uuid.Parse(c.Param("inviteId"))
	if err != nil {
		msg := `invite id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	user := &measure.User{
		ID: &userId,
	}

	userRole, err := user.GetRole(deps.PgPool, teamId.String())
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if userRole.IsUnknown() {
		msg := `couldn't find team, perhaps team id is invalid`
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamInviteSameOrLower)
	if err != nil {
		// FIXME: improve error handling, this is quite brittle way of
		// doing errors. not ideal.
		if err.Error() == "received 'unknown' role" {
			msg := `couldn't find team, perhaps team id is invalid`
			fmt.Println(msg)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": msg,
			})
			return
		}
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to resend invites in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	team := measure.Team{
		ID: &teamId,
	}

	// check if user role can resend invite
	invite, err := team.GetInviteById(c.Request.Context(), deps.PgPool, inviteId.String())
	if err != nil {
		msg := "couldn't perform authorization checks: couldn't fetch invite"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if invite.InvitedAsRole.IsUnknown() {
		msg := "couldn't perform authorization checks: 'invited as role' unknown"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole < invite.InvitedAsRole {
		msg := fmt.Sprintf("you don't have permissions to resend invite [%s] in team [%s]", inviteId, teamId)
		fmt.Println(msg)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	err = team.ResendInvite(c.Request.Context(), deps.PgPool, inviteId)
	if err != nil {
		msg := "failed to resend invite"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	err = team.GetName(c.Request.Context(), deps.PgPool)
	if err != nil {
		msg := `failed to fetch team name. Unable to send invites for new users`
		fmt.Println(msg, err)
	}

	err = user.GetEmail(c.Request.Context(), deps.PgPool)
	if err != nil {
		msg := `failed to fetch user email. Unable to send invites for new users`
		fmt.Println(msg, err)
	}

	subject, body := email.InviteExistingUserEmail(*user.Email, invite.InvitedAsRole.String(), *team.Name, deps.Config.SiteOrigin)

	email.SendEmail(deps.Mail, email.EmailInfo{
		From:        deps.Config.TxEmailAddress,
		To:          invite.Email,
		Subject:     subject,
		ContentType: "text/html",
		Body:        body,
	})

	c.JSON(http.StatusOK, gin.H{
		"ok": fmt.Sprintf("Resent invite %s", inviteId),
	})
}

func (h Handlers) RemoveInvite(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}
	inviteId, err := uuid.Parse(c.Param("inviteId"))
	if err != nil {
		msg := `invite id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	user := &measure.User{
		ID: &userId,
	}

	userRole, err := user.GetRole(deps.PgPool, teamId.String())
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	if userRole.IsUnknown() {
		msg := `couldn't find team, perhaps team id is invalid`
		fmt.Println(msg)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": msg,
		})
		return
	}

	ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamInviteSameOrLower)
	if err != nil {
		// FIXME: improve error handling, this is quite brittle way of
		// doing errors. not ideal.
		if err.Error() == "received 'unknown' role" {
			msg := `couldn't find team, perhaps team id is invalid`
			fmt.Println(msg)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": msg,
			})
			return
		}
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to revoke invites in team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{
			"error": msg,
		})
		return
	}

	team := measure.Team{
		ID: &teamId,
	}

	ctx := c.Request.Context()

	// check if user role can remove invite
	invite, err := team.GetInviteById(ctx, deps.PgPool, inviteId.String())
	if err != nil {
		msg := "couldn't perform authorization checks: couldn't fetch invite"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if invite.InvitedAsRole.IsUnknown() {
		msg := "couldn't perform authorization checks: 'invited as role' unknown"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole < invite.InvitedAsRole {
		msg := fmt.Sprintf("you don't have permissions to remove invite [%s] in team [%s]", inviteId, teamId)
		fmt.Println(msg)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	err = team.RemoveInvite(ctx, deps.PgPool, inviteId)
	if err != nil {
		msg := "failed to remove invite"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": msg,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": fmt.Sprintf("Removed invite %s", inviteId),
	})
}

func (h Handlers) RenameTeam(c *gin.Context) {
	deps := h.Deps
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

	if err != nil || userRole.IsUnknown() {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamAll)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have permissions to rename team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	var payload struct {
		Name *string `json:"name"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := "failed to parse rename payload"
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	name, ok := normalizeTeamName(payload.Name)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team name cannot be empty"})
		return
	}

	team := &measure.Team{ID: &teamId, Name: &name}

	if err := team.Rename(c.Request.Context(), deps.PgPool); err != nil {
		msg := "failed to rename team"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": "team was renamed"})
}

func (h Handlers) GetTeamMembers(c *gin.Context) {
	deps := h.Deps
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

	team := &measure.Team{
		ID: &teamId,
	}

	members, err := team.GetMembers(c.Request.Context(), deps.PgPool)
	if err != nil {
		msg := "failed to query team members"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusOK, members)
}

func (h Handlers) RemoveTeamMember(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	memberId, err := uuid.Parse(c.Param("memberId"))
	if err != nil {
		msg := `member id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	memberIdStr := memberId.String()

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

	ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamChangeRoleSameOrLower)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have modify permissions to team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	team := &measure.Team{
		ID: &teamId,
	}

	memberUser := &measure.User{
		ID: &memberIdStr,
	}

	// check if user role can remove member
	memberRole, err := memberUser.GetRole(deps.PgPool, teamId.String())
	if err != nil {
		msg := "couldn't perform authorization checks: couldn't fetch member role"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if memberRole.IsUnknown() {
		msg := "couldn't perform authorization checks: member role unknown"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole < memberRole {
		msg := fmt.Sprintf("you don't have permissions to remove member [%s] from team [%s]", memberId, teamId)
		fmt.Println(msg)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	if err = team.RemoveMember(c.Request.Context(), deps.PgPool, &memberId); err != nil {
		if errors.Is(err, measure.ErrLastOwner) {
			msg := fmt.Sprintf("cannot remove member [%s]: team [%s] must have at least one owner", memberId, teamId)
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		msg := fmt.Sprintf("couldn't remove member [%s]", memberId)
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	err = team.GetName(c.Request.Context(), deps.PgPool)
	if err != nil {
		msg := `failed to fetch team name. Unable to send email for removed member`
		fmt.Println(msg, err)
	}

	err = user.GetEmail(c.Request.Context(), deps.PgPool)
	if err != nil {
		msg := `failed to fetch user email. Unable to send email for removed member`
		fmt.Println(msg, err)
	}

	err = memberUser.GetEmail(c.Request.Context(), deps.PgPool)
	if err != nil {
		msg := `failed to fetch member email. Unable to send email for removed member`
		fmt.Println(msg, err)
	}

	// invoices and dunning notices from Autumn/Stripe go to the customer
	// email; if it belonged to the removed owner, hand it to a remaining one
	if memberRole == measure.RoleMap["owner"] && memberUser.Email != nil {
		if err := measure.SyncBillingEmailOnOwnerExit(c.Request.Context(), deps.PgPool, deps.Config.IsBillingEnabled(), teamId, *memberUser.Email); err != nil {
			fmt.Println("failed to sync billing email after owner removal:", err)
		}
	}

	// the removed member's dashboard link points at their next default team;
	// with no team left, empty means the dashboard root, which provisions a
	// personal team at next sign-in
	memberTeamId := ""
	if memberDefaultTeam, err := memberUser.GetDefaultTeam(c.Request.Context(), deps.PgPool); err == nil && memberDefaultTeam.ID != nil {
		memberTeamId = memberDefaultTeam.ID.String()
	}

	if team.Name != nil && user.Email != nil && memberUser.Email != nil {
		subject, body := email.RemovedFromTeamEmail(*team.Name, *user.Email, deps.Config.SiteOrigin, memberTeamId)

		email.SendEmail(deps.Mail, email.EmailInfo{
			From:        deps.Config.TxEmailAddress,
			To:          *memberUser.Email,
			Subject:     subject,
			ContentType: "text/html",
			Body:        body,
		})
	}

	c.JSON(http.StatusOK, gin.H{"ok": fmt.Sprintf("removed member [%s] from team [%s]", memberId, teamId)})
}

func (h Handlers) ChangeMemberRole(c *gin.Context) {
	deps := h.Deps
	userId := c.GetString("userId")
	teamId, err := uuid.Parse(c.Param("id"))
	if err != nil {
		msg := `team id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	memberId, err := uuid.Parse(c.Param("memberId"))
	if err != nil {
		msg := `member id invalid or missing`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	memberIdStr := memberId.String()

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

	ok, err := measure.PerformAuthz(deps.PgPool, userId, teamId.String(), *measure.ScopeTeamChangeRoleSameOrLower)
	if err != nil {
		msg := `couldn't perform authorization checks`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}
	if !ok {
		msg := fmt.Sprintf(`you don't have modify permissions to team [%s]`, teamId)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	// bind only the role; the target member comes from the URL param, never
	// the request body
	var payload struct {
		Role *string `json:"role"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		msg := `failed to parse payload`
		fmt.Println(msg, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	if payload.Role == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role is required"})
		return
	}

	newRole := measure.RoleMap[*payload.Role]
	if !newRole.Valid() {
		msg := fmt.Sprintf("role [%s] is not valid", *payload.Role)
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	// a member can only assign roles at or below their own rank
	if userRole < newRole {
		msg := fmt.Sprintf("you don't have permissions to assign role [%s] in team [%s]", *payload.Role, teamId)
		fmt.Println(msg)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	team := &measure.Team{
		ID: &teamId,
	}

	memberUser := &measure.User{
		ID: &memberIdStr,
	}

	// check if user role can change member role
	memberRole, err := memberUser.GetRole(deps.PgPool, teamId.String())
	if err != nil {
		msg := "couldn't perform authorization checks: couldn't fetch member role"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if memberRole.IsUnknown() {
		msg := "couldn't perform authorization checks: member role unknown"
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	if userRole < memberRole {
		msg := fmt.Sprintf("you don't have permissions to change role of member [%s] in team [%s]", memberId, teamId)
		fmt.Println(msg)
		c.JSON(http.StatusForbidden, gin.H{"error": msg})
		return
	}

	if err := team.ChangeRole(c.Request.Context(), deps.PgPool, &memberId, newRole); err != nil {
		if errors.Is(err, measure.ErrLastOwner) {
			msg := fmt.Sprintf("cannot change role of member [%s]: team [%s] must have at least one owner", memberId, teamId)
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		msg := `failed to change role`
		fmt.Println(msg, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	err = team.GetName(c.Request.Context(), deps.PgPool)
	if err != nil {
		msg := `failed to fetch team name. Unable to send email for role changed member`
		fmt.Println(msg, err)
	}

	err = user.GetEmail(c.Request.Context(), deps.PgPool)
	if err != nil {
		msg := `failed to fetch user email. Unable to send email for role changed member`
		fmt.Println(msg, err)
	}

	err = memberUser.GetEmail(c.Request.Context(), deps.PgPool)
	if err != nil {
		msg := `failed to fetch member email. Unable to send email for role changed member`
		fmt.Println(msg, err)
	}

	// invoices and dunning notices from Autumn/Stripe go to the customer
	// email; a member demoted from owner loses billing access, so hand the
	// email to a remaining owner if it was theirs
	if memberRole == measure.RoleMap["owner"] && newRole != measure.RoleMap["owner"] && memberUser.Email != nil {
		if err := measure.SyncBillingEmailOnOwnerExit(c.Request.Context(), deps.PgPool, deps.Config.IsBillingEnabled(), teamId, *memberUser.Email); err != nil {
			fmt.Println("failed to sync billing email after owner demotion:", err)
		}
	}

	if team.Name != nil && user.Email != nil && memberUser.Email != nil {
		subject, body := email.RoleChangedEmail(*payload.Role, *user.Email, *team.Name, deps.Config.SiteOrigin, team.ID.String())

		email.SendEmail(deps.Mail, email.EmailInfo{
			From:        deps.Config.TxEmailAddress,
			To:          *memberUser.Email,
			Subject:     subject,
			ContentType: "text/html",
			Body:        body,
		})
	}

	c.JSON(http.StatusOK, gin.H{"ok": "done"})
}
