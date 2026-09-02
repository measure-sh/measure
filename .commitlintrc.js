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
    "scope-enum": [
      2,
      "always",
      [
        "android",
        "ios",
        "flutter",
        "rn",
        "backend",
        "frontend",
        "deps",
        "gradle",
        "kmp",
      ],
    ],
    /**
     * reduce header max length violation to a warning
     */
    "header-max-length": [1, "always", 72],
    /**
     * allow any casing in the subject
     *
     * type stays lower-case so git-cliff commit parsers keep matching
     */
    "subject-case": [0],
  },
};
