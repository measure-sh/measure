// One thing wrong with a filter the server refused. `span` is where in the
// filter expression it is, counted in characters from zero with `end` one past
// the last character. A fault about the whole filter, such as a limit, has no span.
export type TextSpan = { start: number; end: number };

export type FilterExprIssue = {
  message: string;
  span?: TextSpan;
};

// The `error` a refused filter answers with. Every other error carries its own
// message instead, which is how the filter bar tells an answer it can show from
// one the page has to.
export const invalidFilterExpr = "invalid_filter_expr";

/**
 * The server answered and rejected the request. The message is the server's
 * own `error` field, when the server sends one. `filterExprIssues` is present
 * only when the refusal is about the filter rather than the rest of the
 * request.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly filterExprIssues?: FilterExprIssue[];

  constructor(
    status: number,
    message: string,
    filterExprIssues?: FilterExprIssue[],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.filterExprIssues = filterExprIssues;
  }
}

export function filterExprIssuesIn(error: unknown): FilterExprIssue[] | null {
  if (!(error instanceof ApiError) || error.message !== invalidFilterExpr) {
    return null;
  }
  return error.filterExprIssues ?? [];
}

/**
 * The call failed without a rejection from the server: the connection failed,
 * the URL could not be built, or the response body could not be read.
 */
export class RequestError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RequestError";
  }
}
