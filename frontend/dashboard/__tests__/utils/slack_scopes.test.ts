import {
  REQUIRED_SLACK_SCOPES,
  slackConnectionNeedsReauth,
  slackScopeParam,
} from "@/app/utils/slack_scopes";
import { describe, expect, it } from "@jest/globals";

describe("slackScopeParam", () => {
  it("joins the required scopes into a comma-separated string", () => {
    expect(slackScopeParam()).toBe(REQUIRED_SLACK_SCOPES.join(","));
  });

  it("includes every required scope", () => {
    const scopes = slackScopeParam().split(",");
    for (const required of REQUIRED_SLACK_SCOPES) {
      expect(scopes).toContain(required);
    }
  });
});

describe("slackConnectionNeedsReauth", () => {
  it("does not require reauth when all required scopes are granted", () => {
    expect(slackConnectionNeedsReauth(REQUIRED_SLACK_SCOPES.join(","))).toBe(
      false,
    );
  });

  it("requires reauth for a pre-agent connection with only the old scopes", () => {
    expect(
      slackConnectionNeedsReauth(
        "channels:read,chat:write,groups:read,commands",
      ),
    ).toBe(true);
  });

  it("requires reauth when a single required scope is missing", () => {
    const missingOne = REQUIRED_SLACK_SCOPES.filter(
      (scope) => scope !== "assistant:write",
    ).join(",");
    expect(slackConnectionNeedsReauth(missingOne)).toBe(true);
  });

  it("does not require reauth when extra scopes are present", () => {
    const withExtra = `${REQUIRED_SLACK_SCOPES.join(",")},team:read`;
    expect(slackConnectionNeedsReauth(withExtra)).toBe(false);
  });

  it("does not require reauth when scopes are granted in a different order", () => {
    const reversed = [...REQUIRED_SLACK_SCOPES].reverse().join(",");
    expect(slackConnectionNeedsReauth(reversed)).toBe(false);
  });

  it("tolerates whitespace around scopes", () => {
    const spaced = REQUIRED_SLACK_SCOPES.join(", ");
    expect(slackConnectionNeedsReauth(spaced)).toBe(false);
  });

  it("requires reauth when scopes are present but empty", () => {
    expect(slackConnectionNeedsReauth("")).toBe(true);
  });

  it("does not prompt when scopes are unknown (null or undefined)", () => {
    expect(slackConnectionNeedsReauth(null)).toBe(false);
    expect(slackConnectionNeedsReauth(undefined)).toBe(false);
  });
});
