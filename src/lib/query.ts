import { ApiError } from "./http";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireUuid(value: string, label: string): string {
  if (!UUID.test(value))
    throw new ApiError(400, "invalid_id", `${label} ID is invalid.`);
  return value;
}
