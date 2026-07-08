import { test as base } from "@playwright/test";

// The app under test's Measure app id (a UUID). Page objects put it into
// dashboard URLs as `?a=<appId>`. The runner creates an app for the
// platform it's testing and exports its id as APP_ID.
//
// The team id owning that app. Page objects use it to build dashboard
// paths (`/<teamId>/...`). The runner exports it as TEAM_ID.
export const test = base.extend<{ appId: string; teamId: string }>({
  appId: async ({}, use) => {
    const appId = process.env.APP_ID;
    if (!appId) throw new Error("APP_ID not set");
    await use(appId);
  },
  teamId: async ({}, use) => {
    const teamId = process.env.TEAM_ID;
    if (!teamId) throw new Error("TEAM_ID not set");
    await use(teamId);
  },
});

export { expect } from "@playwright/test";
