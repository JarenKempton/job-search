import { ApiError } from "./http";

export function normalizeError(error: unknown): unknown {
  if (error instanceof ApiError) return error;
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (
      error as { issues: Array<{ path: PropertyKey[]; message: string }> }
    ).issues;
    const first = issues[0];
    const field = first?.path.join(".");
    return new ApiError(
      422,
      "validation_error",
      first
        ? `${field ? `${field}: ` : ""}${first.message}`
        : "Request data is invalid.",
    );
  }
  return error;
}
