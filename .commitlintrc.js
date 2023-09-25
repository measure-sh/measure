export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    /**
     * allowed scopes when committing
     * 
     * e.g.
     * 
     * - fix(android): consumes less energy now
     * - feat(backend): attachments is now available
     * 
     */
    "scope-enum": [2, "always", ["android", "backend", "webapp"]]
  }
}
