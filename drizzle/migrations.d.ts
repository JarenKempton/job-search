import type { migrate } from "drizzle-orm/durable-sqlite/migrator";

declare const config: Parameters<typeof migrate>[1];
export default config;
