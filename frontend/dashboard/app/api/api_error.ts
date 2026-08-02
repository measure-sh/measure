/**
 * The server answered and rejected the request. `status` is the HTTP status.
 * The message is the server's own `error` field, when the server sends one.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * The call failed, but the server did not reject it. The connection failed,
 * the code could not build the URL, or the code could not read the response
 * body. The message names the operation, and `cause` holds the first error.
 */
export class RequestError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RequestError";
  }
}
