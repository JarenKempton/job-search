import { drizzle } from "drizzle-orm/durable-sqlite";
import * as schema from "./schema";

export function database(storage: DurableObjectStorage) {
  return drizzle(storage, { schema, logger: false });
}

export type Database = ReturnType<typeof database>;
