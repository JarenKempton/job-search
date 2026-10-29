import type { Tracker } from "./tracker";

export interface Env {
  TRACKER: DurableObjectNamespace<Tracker>;
  ASSETS: Fetcher;
  JAREN_D1?: D1Database;
  MAKAYLA_D1?: D1Database;
  LEGACY_OWNERS?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { tracker: DurableObjectStub<Tracker> };
};
