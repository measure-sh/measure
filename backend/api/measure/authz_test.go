//go:build integration

package measure

import (
	"reflect"
	"testing"
)

func TestLowerRoles(t *testing.T) {
	{
		expected := []rank{owner, admin, developer, viewer}
		result := owner.getLower()

		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []rank{admin, developer, viewer}
		result := admin.getLower()

		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []rank{developer, viewer}
		result := developer.getLower()

		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		expected := []rank{viewer}
		result := viewer.getLower()

		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
}
func TestSameOrLowerRoleFromScope(t *testing.T) {
	{
		// get owner roles for TeamInviteSameOrLower scope
		expected := []rank{owner, admin, developer, viewer}
		result := ScopeTeamInviteSameOrLower.getRolesSameOrLower(owner)

		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		// get owner roles for TeamChangeRoleSameOrLower scope
		expected := []rank{owner, admin, developer, viewer}
		result := ScopeTeamChangeRoleSameOrLower.getRolesSameOrLower(owner)

		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		// get admin roles for TeamInviteSameOrLower scope
		expected := []rank{admin, developer, viewer}
		result := ScopeTeamInviteSameOrLower.getRolesSameOrLower(admin)

		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		// get admin roles for TeamChangeRoleSameOrLower scope
		expected := []rank{admin, developer, viewer}
		result := ScopeTeamChangeRoleSameOrLower.getRolesSameOrLower(admin)

		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		// get developer roles for TeamInviteSameOrLower scope
		expected := []rank{developer, viewer}
		result := ScopeTeamInviteSameOrLower.getRolesSameOrLower(developer)

		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		// get developer roles for TeamChangeRoleSameOrLower scope
		expected := []rank{developer, viewer}
		result := ScopeTeamChangeRoleSameOrLower.getRolesSameOrLower(developer)

		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		// get viewer roles for TeamInviteSameOrLower scope
		expected := []rank{viewer}
		result := ScopeTeamInviteSameOrLower.getRolesSameOrLower(viewer)

		if !reflect.DeepEqual(expected, result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}
	{
		// get viewer roles for TeamChangeRoleSameOrLower scope
		expected := []rank{}
		result := ScopeTeamChangeRoleSameOrLower.getRolesSameOrLower(viewer)

		if len(expected) != len(result) {
			t.Errorf("Expected %v but got %v", expected, result)
		}
	}

}
