import {
  addRecentSearch,
  getRecentSearches,
  removeRecentSearch,
} from "@/app/utils/network_recent_searches";
import { beforeEach, describe, expect, it } from "@jest/globals";

describe("network recent searches", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the ten most recent endpoints across all domains", () => {
    for (let index = 0; index < 11; index += 1) {
      addRecentSearch("team-1", `api-${index}.example.com`, `/v${index}`);
    }

    const entries = getRecentSearches("team-1");
    expect(entries).toHaveLength(10);
    expect(entries[0]).toEqual({
      domain: "api-10.example.com",
      path: "/v10",
    });
    expect(entries.at(-1)).toEqual({
      domain: "api-1.example.com",
      path: "/v1",
    });
  });

  it("moves an existing endpoint to the front without duplicating it", () => {
    addRecentSearch("team-1", "api.example.com", "/v1/users");
    addRecentSearch("team-1", "api.example.com", "/v1/orders");
    addRecentSearch("team-1", "api.example.com", "/v1/users");

    expect(getRecentSearches("team-1")).toEqual([
      { domain: "api.example.com", path: "/v1/users" },
      { domain: "api.example.com", path: "/v1/orders" },
    ]);
  });

  it("removes only the selected endpoint", () => {
    addRecentSearch("team-1", "api.example.com", "/v1/users");
    addRecentSearch("team-1", "api.example.com", "/v1/orders");
    addRecentSearch("team-1", "other.example.com", "/v1/users");

    removeRecentSearch("team-1", "api.example.com", "/v1/users");

    expect(getRecentSearches("team-1")).toEqual([
      { domain: "other.example.com", path: "/v1/users" },
      { domain: "api.example.com", path: "/v1/orders" },
    ]);
  });

  it("keeps searches separate for each team", () => {
    addRecentSearch("team-1", "api.example.com", "/v1/users");
    addRecentSearch("team-2", "api.example.com", "/v1/orders");

    expect(getRecentSearches("team-1")).toEqual([
      { domain: "api.example.com", path: "/v1/users" },
    ]);
    expect(getRecentSearches("team-2")).toEqual([
      { domain: "api.example.com", path: "/v1/orders" },
    ]);
  });

  it("returns no searches when stored data is malformed", () => {
    localStorage.setItem("network_recent_searches_team-1", "not-json");

    expect(getRecentSearches("team-1")).toEqual([]);
  });
});
