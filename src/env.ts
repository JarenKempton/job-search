export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ACCESS_SERVICE_CLIENT_ID?: string;
}

export type AppEnv = { Bindings: Env };
