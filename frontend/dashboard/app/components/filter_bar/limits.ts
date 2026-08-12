// The limits the server enforces on a filter, copied from
// backend/libs/exprfilter/limits.go.
// limits_sync_test.ts reads the Go constants and fails when they don't match.
export const MAX_FILTER_BYTES = 4096;
export const MAX_DEPTH = 4;
export const MAX_CONDITIONS = 32;
export const MAX_VALUES_PER_CONDITION = 200;
